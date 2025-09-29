import { c as createComponent, a as createAstro, b as renderComponent, r as renderTemplate } from '../chunks/astro/server_CGSRTnYI.mjs';
import 'kleur/colors';
import { a as generateRouteData, $ as $$Page, p as paths } from '../chunks/route-data_DlSBMbEg.mjs';
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro();
const prerender = true;
async function getStaticPaths() {
  return paths;
}
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Index;
  const { Content, headings } = await Astro2.props.entry.render();
  const route = generateRouteData({ props: { ...Astro2.props, headings }, url: Astro2.url });
  return renderTemplate`${renderComponent($$result, "Page", $$Page, { ...route }, { "default": async ($$result2) => renderTemplate`${renderComponent($$result2, "Content", Content, {})}` })}`;
}, "/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@astrojs/starlight/index.astro", void 0);

const $$file = "/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@astrojs/starlight/index.astro";
const $$url = undefined;

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	default: $$Index,
	file: $$file,
	getStaticPaths,
	prerender,
	url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
