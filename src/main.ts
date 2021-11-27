import * as core from '@actions/core'
import * as path from 'path'

import * as caches from './caches'
import * as provision from './provision'

/**
 * The main entry point for the action, called by Github Actions for the step.
 */
export async function run(): Promise<void> {
    try {
        const workspaceDirectory = process.env[`GITHUB_WORKSPACE`] || ''

        await caches.restore(workspaceDirectory)
        await provisionGradle()
    } catch (error) {
        // TODO Perhaps don't fail the job?
        core.setFailed(String(error))
        if (error instanceof Error && error.stack) {
            core.info(error.stack)
        }
    }
}

async function provisionGradle(): Promise<void> {
    const gradleVersion = core.getInput('gradle-version')
    if (gradleVersion !== '' && gradleVersion !== 'wrapper') {
        const gradleExecutable = await provision.gradleVersion(gradleVersion)
        core.addPath(path.dirname(gradleExecutable))
    }
}

run()
