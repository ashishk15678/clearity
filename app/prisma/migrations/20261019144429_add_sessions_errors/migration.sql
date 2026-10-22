-- CreateTable
CREATE TABLE "session_recording" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitorId" TEXT NOT NULL,
    "startUrl" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "duration" INTEGER,
    "frameCount" INTEGER NOT NULL DEFAULT 0,
    "frames" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "session_recording_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "error_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "line" INTEGER,
    "col" INTEGER,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "visitorId" TEXT,
    "breadcrumbs" TEXT NOT NULL DEFAULT '[]',
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "fingerprint" TEXT NOT NULL,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "projectId" TEXT NOT NULL,
    "recordingId" TEXT,
    CONSTRAINT "error_event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "error_event_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "session_recording" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "session_recording_projectId_createdAt_idx" ON "session_recording"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "session_recording_projectId_visitorId_idx" ON "session_recording"("projectId", "visitorId");

-- CreateIndex
CREATE INDEX "error_event_projectId_fingerprint_idx" ON "error_event"("projectId", "fingerprint");

-- CreateIndex
CREATE INDEX "error_event_projectId_createdAt_idx" ON "error_event"("projectId", "createdAt");
