import * as core from '@actions/core'
import {GradleUserHomeCache} from './cache-gradle-user-home'
import {isCacheDisabled, isCacheReadOnly} from './cache-utils'
import {CacheEntryListener, CacheListener} from './cache-base'

const BUILD_ROOT_DIR = 'BUILD_ROOT_DIR'
const CACHE_LISTENER = 'CACHE_LISTENER'

export async function restore(buildRootDirectory: string): Promise<void> {
    const gradleUserHomeCache = new GradleUserHomeCache(buildRootDirectory)

    gradleUserHomeCache.init()

    if (isCacheDisabled()) {
        core.info('Cache is disabled: will not restore state from previous builds.')
        return
    }

    await core.group('Restore Gradle state from cache', async () => {
        core.saveState(BUILD_ROOT_DIR, buildRootDirectory)

        const cacheListener = new CacheListener()
        await gradleUserHomeCache.restore(cacheListener)

        core.saveState(CACHE_LISTENER, cacheListener.stringify())
    })
}

export async function save(): Promise<void> {
    const cacheListener: CacheListener = CacheListener.rehydrate(core.getState(CACHE_LISTENER))

    if (isCacheReadOnly()) {
        core.info('Cache is read-only: will not save state for use in subsequent builds.')
        logCachingReport(cacheListener)
        return
    }

    await core.group('Caching Gradle state', async () => {
        const buildRootDirectory = core.getState(BUILD_ROOT_DIR)
        return new GradleUserHomeCache(buildRootDirectory).save(cacheListener)
    })

    logCachingReport(cacheListener)
}

function logCachingReport(listener: CacheListener): void {
    if (listener.cacheEntries.length === 0) {
        return
    }

    core.info(`---------- Caching Summary -------------
Restored Entries Count: ${getCount(listener.cacheEntries, e => e.restoredSize)}
                  Size: ${getSum(listener.cacheEntries, e => e.restoredSize)}
Saved Entries    Count: ${getCount(listener.cacheEntries, e => e.savedSize)}
                  Size: ${getSum(listener.cacheEntries, e => e.savedSize)}`)

    core.startGroup('Cache Entry details')
    for (const entry of listener.cacheEntries) {
        core.info(`Entry: ${entry.entryName}
    Requested Key : ${entry.requestedKey ?? ''}
    Restored  Key : ${entry.restoredKey ?? ''}
              Size: ${formatSize(entry.restoredSize)}
    Saved     Key : ${entry.savedKey ?? ''}
              Size: ${formatSize(entry.savedSize)}`)
    }
    core.endGroup()
}

function getCount(
    cacheEntries: CacheEntryListener[],
    predicate: (value: CacheEntryListener) => number | undefined
): number {
    return cacheEntries.filter(e => predicate(e) !== undefined).length
}

function getSum(
    cacheEntries: CacheEntryListener[],
    predicate: (value: CacheEntryListener) => number | undefined
): string {
    return formatSize(cacheEntries.map(e => predicate(e) ?? 0).reduce((p, v) => p + v, 0))
}

function formatSize(bytes: number | undefined): string {
    if (bytes === undefined || bytes === 0) {
        return ''
    }
    return `${Math.round(bytes / (1024 * 1024))} MB (${bytes} B)`
}
