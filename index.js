module.exports = {
    nodes: [
        require('./dist/nodes/GhostV2/Ghostv2.node')
    ],
    credentials: [
        require('./dist/credentials/GhostV2AdminApi.credentials'),
        require('./dist/credentials/GhostV2ContentApi.credentials')
    ]
};