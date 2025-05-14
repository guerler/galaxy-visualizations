<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import igv from "igv";
import { LastQueue } from "./lastQueue";
import { GalaxyApi } from "galaxy-charts";

const DELAY = 500;

type Atomic = string | number | boolean | null | undefined;

interface Dataset {
    id: string;
    name: string;
}

interface Track {
    name: string;
    order?: number;
    [key: string]: TrackValue;
}

type TrackValue = Atomic | Dataset | Track;

const lastQueue = new LastQueue<typeof loadGenome>(DELAY);

const props = defineProps({
    datasetId: String,
    datasetUrl: String,
    root: String,
    settings: Object,
    specs: Object,
    tracks: Array<Track>,
});

const message = ref("");
const locus = ref();
const genome = ref();
const tracks = ref();
const viewport = ref(null);

let igvBrowser: any = null;
let igvTracks: Array<Track> = [];

onMounted(() => {
    createBrowser();
});

watch(
    () => props.tracks,
    () => tracksParse(),
    { deep: true, immediate: true },
);

watch(
    () => props,
    () => {
        locus.value = props.settings?.locus;
        genome.value = props.settings?.genome;
    },
    { deep: true, immediate: true },
);

watch(
    () => genome.value,
    () => lastQueue.enqueue(loadGenome, undefined, "loadGenome"),
);

watch(
    () => locus.value,
    () => lastQueue.enqueue(locusSearch, undefined, "locusSearch"),
);

watch(
    () => tracks.value,
    () => lastQueue.enqueue(tracksChanges, undefined, "tracksChanges"),
    { deep: true },
);

async function createBrowser() {
    try {
        igvBrowser = await igv.createBrowser(viewport.value, { genome: genome.value });
        await tracksReload();
        await locusSearch();

        // Temporary styling workaround
        const igvNavBar = igvBrowser.root.querySelector(".igv-navbar");
        if (igvNavBar) {
            Object.assign(igvNavBar.style, {
                flexFlow: "column",
                height: "unset",
                paddingBottom: "3px",
            });
        }
    } catch (e) {
        message.value = "Failed to create browser";
        console.error(message.value, e);
    }
}

async function getFormat(datasetId: string): Promise<string | undefined> {
    try {
        const { data } = await GalaxyApi().GET(`/api/datasets/${datasetId}`);
        return data.extension;
    } catch (e) {
        message.value = `Failed to retrieve dataset type for: ${datasetId}`;
        console.error(message.value, e);
    }
}

function getUrl(datasetId: string): string {
    return `${props.root}api/datasets/${datasetId}/display`;
}

async function loadGenome() {
    if (igvBrowser) {
        try {
            await igvBrowser.loadGenome({ genome: genome.value });
            await tracksReload();
            message.value = "";
        } catch (e) {
            message.value = "Failed to load genome";
            console.error(message.value, genome.value, e);
        }
        await locusSearch();
    }
}

async function locusSearch() {
    if (igvBrowser) {
        if (!locus.value) {
            await igvBrowser.search("all");
        } else if (locusValid(locus.value)) {
            try {
                await igvBrowser.search(locus.value);
            } catch (e) {
                console.warn("[IGV] Invalid locus ignored:", locus.value);
            }
        }
    } else {
        message.value = "Failed to search.";
        console.error("[IGV] Browser not available.");
    }
}

function locusValid(locus: string): boolean {
    const chrPattern = /^[\w.-]+$/;
    const rangePattern = /^[\w.-]+:\d{1,3}(,\d{3})*-\d{1,3}(,\d{3})*$/;
    return chrPattern.test(locus) || rangePattern.test(locus);
}

function trackEquals(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

async function tracksChanges() {
    if (igvBrowser) {
        const newTracks = tracksResolve(tracks.value);
        if (!trackEquals(newTracks, igvTracks)) {
            const oldTrackMap = Object.fromEntries(igvTracks.map((t) => [t.name, t]));
            for (const old of igvTracks) {
                const newTrack = newTracks.find((t) => t.name === old.name);
                if (!newTrack || !trackEquals(newTrack, old)) {
                    const view = await igvBrowser.trackViews.find((tv: any) => tv.track.name === old.name);
                    if (view) {
                        await igvBrowser.removeTrack(view.track);
                    }
                }
            }
            for (const track of newTracks) {
                const oldTrack = oldTrackMap[track.name];
                if (!oldTrack || !trackEquals(track, oldTrack)) {
                    try {
                        await igvBrowser.loadTrack(track);
                    } catch (e) {
                        console.error(`[IGV] Failed to load track '${track.name}'`, e);
                    }
                }
            }
            await igvBrowser.trackViews.sort((a: any, b: any) => {
                const orderA = newTracks.find((t) => t.name === a.track.name)?.order ?? 0;
                const orderB = newTracks.find((t) => t.name === b.track.name)?.order ?? 0;
                return orderB - orderA;
            });
            igvTracks = JSON.parse(JSON.stringify(newTracks));
        }
    }
}

function trackHash(track: Track): string {
    const str = JSON.stringify(track, Object.keys(track).sort());
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36);
}

async function tracksParse() {
    const parsedTracks: Array<Track> = [];
    if (props.tracks) {
        for (const t of props.tracks) {
            const dataset = t.urlDataset as Dataset;
            const index = t.indexUrlDataset as Dataset;
            const url = dataset ? getUrl(dataset.id) : null;
            const indexURL = index ? getUrl(index.id) : null;
            const format = dataset ? await getFormat(dataset.id) : null;
            const displayMode = t.displayMode;
            const name = t.name;
            const type = t.type && t.type !== "auto" ? t.type : trackType(format ?? "");
            const color = t.color;
            const trackConfig: Track = { color, displayMode, format, indexURL, name, type, url };
            console.debug("[IGV] Track:", trackConfig);
            parsedTracks.push(trackConfig);
        }
    }
    tracks.value = parsedTracks;
}

async function tracksReload() {
    igvTracks = [];
    await tracksChanges();
}

function tracksResolve(rawTracks: Array<Track>) {
    const trackSeen = new Set<string>();
    const nameCounts = new Map<string, number>();
    const resolved: Array<Track> = [];
    rawTracks.forEach((track, index) => {
        const baseName = track.name || `track-${trackHash(track)}`;
        const trackKey = JSON.stringify({ ...track, name: baseName });
        const isValid = typeof track?.url === "string" && track.url.trim().length > 0;
        const isDuplicateConfig = trackSeen.has(trackKey);
        if (isValid && !isDuplicateConfig) {
            const count = nameCounts.get(baseName) ?? 0;
            let name = baseName;
            if (count > 0) {
                name = `${baseName} ~ ${count}`;
            }
            nameCounts.set(baseName, count + 1);
            trackSeen.add(trackKey);
            resolved.push({ ...track, name, order: index });
        } else {
            if (!isValid) {
                console.warn(`[IGV] Invalid track skipped: '${baseName}'`);
            }
            if (isDuplicateConfig) {
                console.warn(`[IGV] Duplicate track skipped: '${baseName}'`);
            }
        }
    });
    return resolved;
}

function trackType(format: string = ""): string {
    const normalized = format?.toLowerCase() ?? "";
    if (["bam", "cram"].includes(normalized)) {
        return "alignment";
    }
    if (["vcf", "bcf"].includes(normalized)) {
        return "variant";
    }
    if (["bigwig", "bw", "wig", "bedgraph"].includes(normalized)) {
        return "wig";
    }
    if (["fasta", "fa", "2bit"].includes(normalized)) {
        return "sequence";
    }
    return "annotation";
}
</script>

<template>
    <div class="h-screen overflow-auto">
        <div v-if="message" class="bg-sky-100 border border-sky-200 p-1 rounded text-sky-800 text-sm">
            {{ message }}
        </div>
        <div ref="viewport"></div>
    </div>
</template>
