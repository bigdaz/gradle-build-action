import * as core from '@actions/core'
import * as path from 'path'
import * as os from 'os'
import {parseArgsStringToArgv} from 'string-argv'

import * as caches from './caches'
import * as execution from './execution'
import * as gradlew from './gradlew'
import * as provision from './provision'

/**
 * The main entry point for the action, called by Github Actions for the step.
 */
export async function run(): Promise<void> {
    try {
        const workspaceDirectory = process.env[`GITHUB_WORKSPACE`] || ''
        const buildRootDirectory = resolveBuildRootDirectory(workspaceDirectory)
        const gradleUserHome = determineGradleUserHome(buildRootDirectory)

        await caches.restore(gradleUserHome)
        let executable = await provisionGradleVersion()

        const args: string[] = parseCommandLineArguments()

        // If no arguments are provided, then don't invoke Gradle
        if (args.length === 0) {
            return
        }

        if (executable === undefined) {
            executable = locateGradleWrapper(workspaceDirectory, buildRootDirectory)
        }
        const result = await execution.execute(executable, buildRootDirectory, args)

        if (result.status !== 0) {
            if (result.buildScanUrl) {
                core.setFailed(`Gradle build failed: ${result.buildScanUrl}`)
            } else {
                core.setFailed(`Gradle build failed: process exited with status ${result.status}`)
            }
        }
    } catch (error) {
        core.setFailed(String(error))
        if (error instanceof Error && error.stack) {
            core.info(error.stack)
        }
    }
}

run()

function resolveBuildRootDirectory(baseDirectory: string): string {
    const buildRootDirectory = core.getInput('build-root-directory')
    const resolvedBuildRootDirectory =
        buildRootDirectory === '' ? path.resolve(baseDirectory) : path.resolve(baseDirectory, buildRootDirectory)
    return resolvedBuildRootDirectory
}

function determineGradleUserHome(rootDir: string): string {
    const customGradleUserHome = process.env['GRADLE_USER_HOME']
    if (customGradleUserHome) {
        return path.resolve(rootDir, customGradleUserHome)
    }

    return path.resolve(os.homedir(), '.gradle')
}

async function provisionGradleVersion(): Promise<string | undefined> {
    const gradleVersion = core.getInput('gradle-version')
    if (gradleVersion !== '' && gradleVersion !== 'wrapper') {
        const gradleExecutable = path.resolve(await provision.gradleVersion(gradleVersion))
        core.addPath(path.dirname(gradleExecutable))
        return gradleExecutable
    }
    return undefined
}

function locateGradleWrapper(workspaceDirectory: string, buildRootDirectory: string): string {
    const gradleExecutable = core.getInput('gradle-executable')
    if (gradleExecutable !== '') {
        return path.resolve(workspaceDirectory, gradleExecutable)
    }

    return gradlew.locateGradleWrapperScript(buildRootDirectory)
}

function parseCommandLineArguments(): string[] {
    const input = core.getInput('arguments')
    return parseArgsStringToArgv(input)
}
