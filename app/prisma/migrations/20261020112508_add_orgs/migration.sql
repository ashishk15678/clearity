/*
  Warnings:

  - You are about to drop the column `fingerprint` on the `error_event` table. All the data in the column will be lost.
  - You are about to drop the column `occurrences` on the `error_event` table. All the data in the column will be lost.
  - You are about to drop the column `resolvedAt` on the `error_event` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `error_event` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `error_event` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `event` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `event` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `event` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `page_view` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `page_view` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `page_view` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `frameCount` on the `session_recording` table. All the data in the column will be lost.
  - You are about to drop the column `frames` on the `session_recording` table. All the data in the column will be lost.
  - Added the required column `groupId` to the `error_event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `path` to the `page_view` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `project` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "organization_member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "organization_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_recording_chunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordingId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "framesCount" INTEGER NOT NULL DEFAULT 0,
    "frames" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_recording_chunk_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "session_recording" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "error_group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fingerprint" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unresolved',
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "error_group_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_account" ("accessToken", "accessTokenExpiresAt", "accountId", "createdAt", "id", "idToken", "password", "providerId", "refreshToken", "refreshTokenExpiresAt", "scope", "updatedAt", "userId") SELECT "accessToken", "accessTokenExpiresAt", "accountId", "createdAt", "id", "idToken", "password", "providerId", "refreshToken", "refreshTokenExpiresAt", "scope", "updatedAt", "userId" FROM "account";
DROP TABLE "account";
ALTER TABLE "new_account" RENAME TO "account";
CREATE TABLE "new_error_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "url" TEXT,
    "line" INTEGER,
    "col" INTEGER,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "visitorId" TEXT,
    "breadcrumbs" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "recordingId" TEXT,
    CONSTRAINT "error_event_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "error_group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "error_event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "error_event_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "session_recording" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_error_event" ("breadcrumbs", "col", "createdAt", "id", "ipAddress", "line", "message", "projectId", "recordingId", "stack", "url", "userAgent", "visitorId") SELECT "breadcrumbs", "col", "createdAt", "id", "ipAddress", "line", "message", "projectId", "recordingId", "stack", "url", "userAgent", "visitorId" FROM "error_event";
DROP TABLE "error_event";
ALTER TABLE "new_error_event" RENAME TO "error_event";
CREATE INDEX "error_event_groupId_createdAt_idx" ON "error_event"("groupId", "createdAt");
CREATE INDEX "error_event_projectId_createdAt_idx" ON "error_event"("projectId", "createdAt");
CREATE INDEX "error_event_recordingId_idx" ON "error_event"("recordingId");
CREATE TABLE "new_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "properties" TEXT NOT NULL DEFAULT '{}',
    "url" TEXT,
    "selector" TEXT,
    "x" INTEGER,
    "y" INTEGER,
    "visitorId" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "recordingId" TEXT,
    CONSTRAINT "event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "session_recording" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_event" ("createdAt", "id", "name", "projectId", "properties", "type", "url", "userId") SELECT "createdAt", "id", "name", "projectId", "properties", "type", "url", "userId" FROM "event";
DROP TABLE "event";
ALTER TABLE "new_event" RENAME TO "event";
CREATE INDEX "event_projectId_createdAt_idx" ON "event"("projectId", "createdAt");
CREATE INDEX "event_projectId_type_url_idx" ON "event"("projectId", "type", "url");
CREATE INDEX "event_recordingId_idx" ON "event"("recordingId");
CREATE TABLE "new_page_view" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "visitorId" TEXT,
    "userId" TEXT,
    "duration" INTEGER,
    "maxScrollY" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "recordingId" TEXT,
    CONSTRAINT "page_view_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "page_view_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "session_recording" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_page_view" ("createdAt", "duration", "id", "projectId", "referrer", "url", "userId") SELECT "createdAt", "duration", "id", "projectId", "referrer", "url", "userId" FROM "page_view";
DROP TABLE "page_view";
ALTER TABLE "new_page_view" RENAME TO "page_view";
CREATE INDEX "page_view_projectId_createdAt_idx" ON "page_view"("projectId", "createdAt");
CREATE INDEX "page_view_projectId_path_idx" ON "page_view"("projectId", "path");
CREATE INDEX "page_view_recordingId_idx" ON "page_view"("recordingId");
CREATE TABLE "new_project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_project" ("createdAt", "description", "id", "name", "slug", "updatedAt", "url") SELECT "createdAt", "description", "id", "name", "slug", "updatedAt", "url" FROM "project";
DROP TABLE "project";
ALTER TABLE "new_project" RENAME TO "project";
CREATE INDEX "project_organizationId_idx" ON "project"("organizationId");
CREATE UNIQUE INDEX "project_organizationId_slug_key" ON "project"("organizationId", "slug");
CREATE TABLE "new_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_session" ("createdAt", "expiresAt", "id", "ipAddress", "token", "updatedAt", "userAgent", "userId") SELECT "createdAt", "expiresAt", "id", "ipAddress", "token", "updatedAt", "userAgent", "userId" FROM "session";
DROP TABLE "session";
ALTER TABLE "new_session" RENAME TO "session";
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");
CREATE TABLE "new_session_recording" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "startUrl" TEXT NOT NULL,
    "exitUrl" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "country" TEXT,
    "deviceType" TEXT,
    "os" TEXT,
    "browser" TEXT,
    "viewportW" INTEGER,
    "viewportH" INTEGER,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "rageClickCount" INTEGER NOT NULL DEFAULT 0,
    "deadClickCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "session_recording_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_session_recording" ("createdAt", "duration", "id", "ipAddress", "projectId", "startUrl", "updatedAt", "userAgent", "visitorId") SELECT "createdAt", coalesce("duration", 0) AS "duration", "id", "ipAddress", "projectId", "startUrl", "updatedAt", "userAgent", "visitorId" FROM "session_recording";
DROP TABLE "session_recording";
ALTER TABLE "new_session_recording" RENAME TO "session_recording";
CREATE INDEX "session_recording_projectId_createdAt_idx" ON "session_recording"("projectId", "createdAt");
CREATE INDEX "session_recording_projectId_visitorId_idx" ON "session_recording"("projectId", "visitorId");
CREATE INDEX "session_recording_projectId_rageClickCount_idx" ON "session_recording"("projectId", "rageClickCount");
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_user" ("createdAt", "email", "emailVerified", "id", "image", "name", "updatedAt") SELECT "createdAt", "email", "emailVerified", "id", "image", "name", "updatedAt" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE TABLE "new_verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);
INSERT INTO "new_verification" ("createdAt", "expiresAt", "id", "identifier", "updatedAt", "value") SELECT "createdAt", "expiresAt", "id", "identifier", "updatedAt", "value" FROM "verification";
DROP TABLE "verification";
ALTER TABLE "new_verification" RENAME TO "verification";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organization_member_organizationId_userId_key" ON "organization_member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "session_recording_chunk_recordingId_idx" ON "session_recording_chunk"("recordingId");

-- CreateIndex
CREATE UNIQUE INDEX "session_recording_chunk_recordingId_sequence_key" ON "session_recording_chunk"("recordingId", "sequence");

-- CreateIndex
CREATE INDEX "error_group_projectId_status_lastSeenAt_idx" ON "error_group"("projectId", "status", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "error_group_projectId_fingerprint_key" ON "error_group"("projectId", "fingerprint");

-- CreateIndex
CREATE INDEX "api_key_projectId_idx" ON "api_key"("projectId");
