import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://com-junkawasaki.github.io',
  base: process.env.NODE_ENV === 'production' ? '/actordb-dokigoto' : '/',
  integrations: [
    starlight({
      title: 'ActorDB TypeScript',
      description: 'Complete TypeScript implementation of ActorDB following process network graph model',
      logo: {
        src: './src/assets/logo.svg',
      },
      social: {
        github: 'https://github.com/junkawasaki/actordb-dokigoto',
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Overview', link: '/getting-started/overview' },
            { label: 'Installation', link: '/getting-started/installation' },
            { label: 'Quick Start', link: '/getting-started/quick-start' },
          ]
        },
        {
          label: 'Architecture',
          items: [
            { label: 'Process Network', link: '/architecture/process-network' },
            { label: 'Merkle DAG', link: '/architecture/merkle-dag' },
          ]
        },
        {
          label: 'Components',
          items: [
            { label: 'Security Gateway', link: '/components/security-gateway' },
            { label: 'EventStore', link: '/components/eventstore' },
          ]
        },
      ],
      customCss: ['./src/styles/custom.css'],
      components: {
        // Override the default `SocialIcons` component.
        // SocialIcons: './src/components/MySocialIcons.astro',
      },
    }),
    tailwind({
      applyBaseStyles: false
    }),
  ],
});
