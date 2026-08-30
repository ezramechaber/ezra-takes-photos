import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const outputRoot = path.resolve('.next/standalone')
const destinationRoot = path.join(outputRoot, 'node_modules/@img')
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'figma-sharp-'))

const packages = [
  '@img/sharp-linux-arm64@0.35.4',
  '@img/sharp-libvips-linux-arm64@1.3.3',
]

try {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const install = spawnSync(
    npm,
    [
      'install',
      '--prefix',
      temporaryRoot,
      '--no-package-lock',
      '--os=linux',
      '--cpu=arm64',
      '--libc=glibc',
      '--force',
      '--ignore-scripts',
      '--no-save',
      '--no-audit',
      '--no-fund',
      ...packages,
    ],
    { stdio: 'inherit' },
  )

  if (install.status !== 0) {
    throw new Error(`Could not install the Figma Cloud sharp runtime (npm exit ${install.status})`)
  }

  await mkdir(destinationRoot, { recursive: true })

  for (const packageName of ['sharp-linux-arm64', 'sharp-libvips-linux-arm64']) {
    const source = path.join(temporaryRoot, 'node_modules/@img', packageName)
    const destination = path.join(destinationRoot, packageName)
    await cp(source, destination, { force: true, recursive: true })
  }

  console.log('Packaged sharp for Figma Cloud (Linux ARM64).')
} finally {
  await rm(temporaryRoot, { force: true, recursive: true })
}
