// Export the visible scientific view without browser capture permissions or a
// remote service. Molstar's image pass retains WebGL pixels even when its live
// drawing buffer is discarded; chart canvases retain their current selection.

function imageFromUrl(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Could not render the molecular image"));
        image.src = url;
    });
}

function paintText(context, node, root) {
    const style = getComputedStyle(node.parentElement);
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    context.fillStyle = style.color;
    context.textBaseline = "top";
    // Text ranges preserve the browser's wrapping and alignment for headings,
    // chain counts and selection labels, including a scrolled narrow layout.
    const range = document.createRange();
    let line = "";
    let previous = null;
    const flush = () => {
        if (line && previous) context.fillText(line, previous.left - root.left, previous.top - root.top);
    };
    for (let index = 0; index < node.length; index += 1) {
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        if (previous && Math.abs(rect.top - previous.top) > 1) {
            flush();
            line = "";
            previous = null;
        }
        if (!previous) previous = rect;
        line += node.textContent[index];
    }
    flush();
}

function paintOverlay(context, element, root) {
    if (element.hidden || element.matches(".heatmap-tooltip, .analysis-debug-overlay")) return;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom <= root.top || rect.top >= root.bottom) return;
    const x = rect.left - root.left;
    const y = rect.top - root.top;
    context.fillStyle = style.backgroundColor;
    context.fillRect(x, y, rect.width, rect.height);
    for (const [side, start, end] of [
        ["Top", [x, y], [x + rect.width, y]],
        ["Right", [x + rect.width, y], [x + rect.width, y + rect.height]],
        ["Bottom", [x, y + rect.height], [x + rect.width, y + rect.height]],
        ["Left", [x, y], [x, y + rect.height]],
    ]) {
        const width = parseFloat(style[`border${side}Width`]);
        if (width && style[`border${side}Style`] !== "none") {
            context.strokeStyle = style[`border${side}Color`];
            context.lineWidth = width;
            context.beginPath();
            context.moveTo(...start);
            context.lineTo(...end);
            context.stroke();
        }
    }
    if (element instanceof HTMLCanvasElement) {
        context.drawImage(element, x, y, rect.width, rect.height);
        return;
    }
    context.save();
    if ([style.overflowX, style.overflowY].some((value) => ["hidden", "scroll", "auto", "clip"].includes(value))) {
        context.beginPath();
        context.rect(x, y, rect.width, rect.height);
        context.clip();
    }
    for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) paintText(context, child, root);
        else if (child.nodeType === Node.ELEMENT_NODE) paintOverlay(context, child, root);
    }
    context.restore();
}

export async function saveViewImage({ plugin, viewport, region, overlay, mode }) {
    const root = region.getBoundingClientRect();
    const scale = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(root.width * scale);
    canvas.height = Math.round(root.height * scale);
    if (!canvas.width || !canvas.height) throw new Error("The view has no visible image area");
    const context = canvas.getContext("2d");
    context.scale(scale, scale);
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, root.width, root.height);

    // Freeze the plots/labels before the asynchronous molecular render.
    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = canvas.width;
    overlayCanvas.height = canvas.height;
    const overlayContext = overlayCanvas.getContext("2d");
    overlayContext.scale(scale, scale);
    if (overlay) paintOverlay(overlayContext, overlay, root);

    if (mode !== "heatmap") {
        const helper = plugin.helpers.viewportScreenshot;
        if (!helper) throw new Error("Molecular image export is unavailable");
        const rect = viewport.querySelector("canvas").getBoundingClientRect();
        const previousValues = helper.values;
        const previousCrop = helper.relativeCrop;
        try {
            helper.behaviors.values.next({
                ...previousValues,
                resolution: {
                    name: "custom",
                    params: { width: Math.round(rect.width * scale), height: Math.round(rect.height * scale) },
                },
                format: { name: "png", params: {} },
                transparent: false,
            });
            helper.resetCrop();
            const image = await imageFromUrl(await helper.getImageDataUri());
            context.drawImage(image, rect.left - root.left, rect.top - root.top, rect.width, rect.height);
        } finally {
            helper.behaviors.values.next(previousValues);
            helper.behaviors.relativeCrop.next(previousCrop);
        }
    }
    context.drawImage(overlayCanvas, 0, 0, root.width, root.height);
    const current = region.getBoundingClientRect();
    if (Math.abs(current.width - root.width) > 1 || Math.abs(current.height - root.height) > 1) {
        throw new Error("The view was resized while saving. Please save the image again");
    }
    const blob = await new Promise((resolve, reject) =>
        canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("PNG encoding failed"))), "image/png"),
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `rmsx-flipbook-${mode}.png`;
    link.href = url;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
