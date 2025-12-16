/**
 * Sync Manager
 * Handles offline-first sync between localStorage and server
 */
class SyncManager {
    constructor(app, api) {
        this.app = app;
        this.api = api;
        this.lastSyncAt = localStorage.getItem('lastSyncAt');
        this.syncQueue = JSON.parse(localStorage.getItem('syncQueue') || '[]');
        this.isSyncing = false;
        this.syncDebounceTimer = null;
        this.SYNC_DEBOUNCE_MS = 2000;

        // Listen for online/offline events
        window.addEventListener('online', () => this.onOnline());
        window.addEventListener('offline', () => this.onOffline());

        // Listen for visibility change (tab focus)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.checkAndSync();
            }
        });
    }

    isOnline() {
        return navigator.onLine;
    }

    onOnline() {
        console.log('Back online - syncing...');
        this.processQueue();
    }

    onOffline() {
        console.log('Gone offline - changes will be queued');
        this.updateSyncStatus('offline');
    }

    updateSyncStatus(status) {
        const statusEl = document.getElementById('sync-status');
        if (!statusEl) return;

        statusEl.className = `sync-status sync-${status}`;
        const icons = {
            synced: '✓',
            syncing: '↻',
            offline: '○',
            error: '!'
        };
        statusEl.textContent = icons[status] || '';
        statusEl.title = status.charAt(0).toUpperCase() + status.slice(1);
    }

    // Queue a local change for sync
    queueChange(entityType, action, data) {
        if (!this.api.isAuthenticated()) return;

        this.syncQueue.push({
            entityType,
            action,
            data,
            timestamp: new Date().toISOString()
        });
        this.saveSyncQueue();

        // Debounced sync
        this.debouncedSync();
    }

    saveSyncQueue() {
        localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
    }

    debouncedSync() {
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
        }
        this.syncDebounceTimer = setTimeout(() => {
            if (this.isOnline()) {
                this.processQueue();
            }
        }, this.SYNC_DEBOUNCE_MS);
    }

    // Check if should sync (e.g., after 5 minutes)
    async checkAndSync() {
        if (!this.api.isAuthenticated() || !this.isOnline()) return;

        const lastSync = this.lastSyncAt ? new Date(this.lastSyncAt) : null;
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        if (!lastSync || lastSync < fiveMinutesAgo) {
            await this.sync();
        }
    }

    // Process queued changes
    async processQueue() {
        if (!this.api.isAuthenticated() || !this.isOnline() || this.isSyncing) return;
        if (this.syncQueue.length === 0) return;

        this.isSyncing = true;
        this.updateSyncStatus('syncing');

        try {
            // Group changes by entity type
            const changes = {
                folders: { upsert: [], delete: [] },
                sets: { upsert: [], delete: [] },
                cards: { upsert: [], delete: [] },
                streak: null
            };

            for (const item of this.syncQueue) {
                if (item.entityType === 'streak') {
                    changes.streak = item.data;
                } else if (item.action === 'delete') {
                    changes[item.entityType].delete.push(item.data.localId || item.data.id);
                } else {
                    changes[item.entityType].upsert.push(item.data);
                }
            }

            const result = await this.api.pushChanges(changes, this.lastSyncAt);

            if (result.success) {
                // Clear processed queue
                this.syncQueue = [];
                this.saveSyncQueue();

                // Update last sync time
                this.lastSyncAt = result.data.serverTime;
                localStorage.setItem('lastSyncAt', this.lastSyncAt);

                // Handle conflicts (last-write-wins - server version)
                if (result.data.conflicts?.length > 0) {
                    this.handleConflicts(result.data.conflicts);
                }

                this.updateSyncStatus('synced');
            }
        } catch (error) {
            console.error('Sync push failed:', error);
            this.updateSyncStatus('error');
        } finally {
            this.isSyncing = false;
        }
    }

    // Full sync with server
    async sync() {
        if (!this.api.isAuthenticated() || !this.isOnline() || this.isSyncing) return;

        this.isSyncing = true;
        this.updateSyncStatus('syncing');

        try {
            // First push any queued changes
            if (this.syncQueue.length > 0) {
                await this.processQueue();
            }

            // Then pull changes from server
            const result = await this.api.pullChanges(this.lastSyncAt);

            if (result.success) {
                this.mergeServerData(result.data);

                // Update last sync time
                this.lastSyncAt = result.data.serverTime;
                localStorage.setItem('lastSyncAt', this.lastSyncAt);

                this.updateSyncStatus('synced');
            }
        } catch (error) {
            console.error('Sync failed:', error);
            this.updateSyncStatus('error');
        } finally {
            this.isSyncing = false;
        }
    }

    // Initial full sync after login
    async initialSync() {
        if (!this.api.isAuthenticated() || !this.isOnline()) return;

        this.isSyncing = true;
        this.updateSyncStatus('syncing');

        try {
            const result = await this.api.fullSync();

            if (result.success) {
                // Replace local data with server data
                this.replaceLocalData(result.data);

                // Update last sync time
                this.lastSyncAt = result.data.serverTime;
                localStorage.setItem('lastSyncAt', this.lastSyncAt);

                // Clear any queued changes
                this.syncQueue = [];
                this.saveSyncQueue();

                this.updateSyncStatus('synced');
                return true;
            }
        } catch (error) {
            console.error('Initial sync failed:', error);
            this.updateSyncStatus('error');
        } finally {
            this.isSyncing = false;
        }
        return false;
    }

    // Merge server data with local (for pull)
    mergeServerData(serverData) {
        const localData = this.app.data;

        // Merge created/updated folders
        if (serverData.folders?.created) {
            for (const folder of serverData.folders.created) {
                if (!localData.folders[folder.folderId]) {
                    localData.folders[folder.folderId] = {
                        name: folder.name,
                        flag: folder.flag,
                        sets: []
                    };
                }
            }
        }

        // Handle deleted folders
        if (serverData.folders?.deleted) {
            for (const folderId of serverData.folders.deleted) {
                delete localData.folders[folderId];
            }
        }

        // Merge sets and cards (more complex - would need proper ID mapping)
        // For simplicity, we'll reload the UI
        this.app.saveData();
        this.app.showLibrary();

        // Update streak
        if (serverData.streak) {
            this.app.streakData = serverData.streak;
            this.app.saveStreakData();
            this.app.updateStreakUI();
        }
    }

    // Replace local data completely (for initial sync)
    replaceLocalData(serverData) {
        // Build local data structure from server data
        const newData = { folders: {} };

        // Group sets by folder
        const setsByFolder = {};
        for (const set of serverData.sets || []) {
            const folder = serverData.folders.find(f => f._id === set.folderId.toString());
            if (folder) {
                if (!setsByFolder[folder.folderId]) {
                    setsByFolder[folder.folderId] = [];
                }
                setsByFolder[folder.folderId].push(set);
            }
        }

        // Group cards by set
        const cardsBySet = {};
        for (const card of serverData.cards || []) {
            if (!cardsBySet[card.setId]) {
                cardsBySet[card.setId] = [];
            }
            cardsBySet[card.setId].push({
                id: card.localId,
                front: card.front,
                back: card.back,
                example: card.example || '',
                image: card.imageUrl || null,
                starred: card.starred,
                mastery: card.mastery,
                sr: card.sr
            });
        }

        // Build folders
        for (const folder of serverData.folders || []) {
            const sets = setsByFolder[folder.folderId] || [];
            newData.folders[folder.folderId] = {
                name: folder.name,
                flag: folder.flag,
                sets: sets.map(set => ({
                    id: set.localId,
                    name: set.name,
                    description: set.description || '',
                    cards: cardsBySet[set._id] || []
                }))
            };
        }

        // Update app data
        this.app.data = newData;
        this.app.saveData();
        this.app.showLibrary();

        // Update streak
        if (serverData.streak) {
            this.app.streakData = serverData.streak;
            this.app.saveStreakData();
            this.app.updateStreakUI();
        }
    }

    // Handle conflicts (server wins by default)
    handleConflicts(conflicts) {
        console.log('Conflicts detected:', conflicts);
        // For last-write-wins, we accept server version
        // Could show UI notification here
    }
}
