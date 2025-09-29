import { c as createComponent, m as maybeRenderHead, u as unescapeHTML, r as renderTemplate, a as createAstro, b as renderComponent } from '../chunks/astro/server_CGSRTnYI.mjs';
import 'kleur/colors';
import { c as config, u as useTranslations, g as getEntry, a as generateRouteData, $ as $$Page } from '../chunks/route-data_DlSBMbEg.mjs';
import 'clsx';
export { renderers } from '../renderers.mjs';

const html = "";

				const frontmatter = {};
				const file = "/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@astrojs/starlight/components/EmptyMarkdown.md";
				const url = undefined;

				const Content = createComponent((result, _props, slots) => {
					const { layout, ...content } = frontmatter;
					content.file = file;
					content.url = url;

					return renderTemplate`${maybeRenderHead()}${unescapeHTML(html)}`;
				});

const $$Astro = createAstro();
const prerender = true;
const $$404 = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$404;
  const { lang = "en", dir = "ltr" } = config.defaultLocale || {};
  let locale = config.defaultLocale?.locale;
  if (locale === "root") locale = void 0;
  const entryMeta = { dir, lang, locale };
  const t = useTranslations(locale);
  const fallbackEntry = {
    slug: "404",
    id: "404.md",
    body: "",
    collection: "docs",
    data: {
      title: "404",
      template: "splash",
      editUrl: false,
      head: [],
      hero: { tagline: t("404.text"), actions: [] },
      pagefind: false,
      sidebar: { hidden: false, attrs: {} }
    },
    render: async () => ({
      Content: Content,
      headings: [],
      remarkPluginFrontmatter: {}
    })
  };
  const userEntry = await getEntry("docs", "404");
  const entry = userEntry || fallbackEntry;
  const { Content: Content$1, headings } = await entry.render();
  const route = generateRouteData({
    props: { ...entryMeta, entryMeta, headings, entry, id: entry.id, slug: entry.slug },
    url: Astro2.url
  });
  return renderTemplate`${renderComponent($$result, "Page", $$Page, { ...route }, { "default": async ($$result2) => renderTemplate`${renderComponent($$result2, "Content", Content$1, {})}` })}`;
}, "/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@astrojs/starlight/404.astro", void 0);

const $$file = "/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@astrojs/starlight/404.astro";
const $$url = undefined;

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	default: $$404,
	file: $$file,
	prerender,
	url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
