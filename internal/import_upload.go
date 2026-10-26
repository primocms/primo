package internal

// Archive imports contain an entire site's assets, so they need a larger
// request budget than ordinary API calls. Keep the override on import routes.
const maxImportRequestBytes int64 = 512 << 20

// ParseMultipartForm's argument is an in-memory threshold, not an upload
// limit. Larger file parts spill to temporary files instead of being rejected.
const importMultipartMemoryBytes int64 = 32 << 20
