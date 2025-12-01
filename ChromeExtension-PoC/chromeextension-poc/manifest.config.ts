import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  description: "PoC app for browser plugin translations",
  icons: {
    48: 'logo.png',
    32: 'logo.png',
    128: 'logo.png'
  },
  action: {
    default_icon: {
      48: 'logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  permissions: [
    'scripting',
    'activeTab',
  ],
  host_permissions: [
    'https://*/*'
  ],
  content_scripts: [
    {
      matches: ['https://*/*'],
      js: ['src/content/main.tsx'],
      run_at: 'document_idle'
    }
  ],
  web_accessible_resources: [
    {
      resources: [
        'models/**/*',
        'transformers/*.wasm',
        'transformers/*.mjs'
      ],
      matches: ['<all_urls>'],
      use_dynamic_url: false
    }
  ]
})
