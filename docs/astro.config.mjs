import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
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
            { label: 'Topological Ordering', link: '/architecture/topological-ordering' },
          ]
        },
        {
          label: 'Components',
          items: [
            { label: 'Security Gateway', link: '/components/security-gateway' },
            { label: 'EventStore', link: '/components/eventstore' },
            { label: 'Projection Engine', link: '/components/projection-engine' },
            { label: 'Query Interface', link: '/components/query-interface' },
            { label: 'Control Plane', link: '/components/control-plane' },
          ]
        },
        {
          label: 'API Reference',
          items: [
            { label: 'Configuration', link: '/api/configuration' },
            { label: 'Storage Backends', link: '/api/storage' },
            { label: 'REST APIs', link: '/api/rest-apis' },
          ]
        },
        {
          label: 'Guides',
          items: [
            { label: 'Custom Projections', link: '/guides/custom-projections' },
            { label: 'Storage Configuration', link: '/guides/storage-config' },
            { label: 'Security Setup', link: '/guides/security-setup' },
            { label: 'Monitoring', link: '/guides/monitoring' },
          ]
        },
        {
          label: 'Examples',
          items: [
            { label: 'Basic Event Sourcing', link: '/examples/basic-eventsourcing' },
            { label: 'CQRS with Projections', link: '/examples/cqrs-projections' },
            { label: 'Real-time Dashboards', link: '/examples/realtime-dashboards' },
          ]
        }
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
