/* Keep full seeded-route trials off the homepage animation thread. */
importScripts('canvas-games.js');

self.onmessage = event => {
    const { id, seed } = event.data;
    try {
        const plan = CanvasGames.planSnakeCandidates(seed, {
            candidates: 8,
            onProgress: progress => self.postMessage({ id, type: 'progress', ...progress })
        });
        self.postMessage({ id, type: 'complete', plan });
    } catch (error) {
        self.postMessage({ id, type: 'error', message: error.message });
    }
};
