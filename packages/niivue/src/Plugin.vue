<script setup>
import { onMounted, ref, watch } from "vue";
import { GalaxyApi } from "galaxy-charts";
import { NAlert } from "naive-ui";
import { Niivue } from "@niivue/niivue";

const props = defineProps({
    datasetId: String,
    datasetUrl: String,
    root: String,
    settings: Object,
    specs: Object,
    tracks: Array,
});

const errorMessage = ref("");
const viewport = ref();

let nv;

const MESH_TYPES = {}

const VOLUME_TYPES = {
    "nii1": "nii",
    "nii1.gz": "nii.gz",
    "png": "png",
}

async function create() {
    try {
        const { data } = await GalaxyApi().GET(`/api/datasets/${props.datasetId}`);
        const extension = data?.extension;
        if (VOLUME_TYPES[extension]) {
            const url = `${props.datasetUrl}?extension=.${VOLUME_TYPES[extension]}`;
            console.log(url);
            nv = new Niivue();
            await nv.attachTo("niivue-viewport");
            await nv.loadVolumes([{ url }]);
        } else if (MESH_TYPES[extension]) {
            const url = `${props.datasetUrl}?extension=.${MESH_TYPES[extension]}`;
            nv = new Niivue();
            nv.opts.is3D = true;
            await nv.attachTo("niivue-viewport");
            await nv.loadMeshes([{ url }]);
        } else {
            errorMessage.value = `Unsupported file format: ${extension}.`;
        }
    } catch (e) {
        errorMessage.value = `Failed to render: ${e}`;
        throw new Error(e);
    }
}

async function render() {
    if (nv) {
        nv.setColormap(nv.volumes[0].id, props.settings.colormap);
        nv.setInterpolation(props.settings.interpolation);
        nv.setGamma(props.settings.gamma);
        nv.setOpacity(0, props.settings.opacity);
        nv.opts.isColorbar = props.settings.is_colorbar;
        nv.drawScene();
    }
}

onMounted(() => {
    create();
});

watch(
    () => props,
    () => render(),
    { deep: true },
);
</script>

<template>
    <n-alert v-if="errorMessage" type="error" class="m-2">{{ errorMessage }}</n-alert>
    <canvas v-else id="niivue-viewport" ref="viewport" />
</template>
