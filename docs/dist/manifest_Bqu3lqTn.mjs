import '@astrojs/internal-helpers/path';
import 'cookie';
import 'kleur/colors';
import 'es-module-lexer';
import { N as NOOP_MIDDLEWARE_HEADER, n as decodeKey } from './chunks/astro/server_CGSRTnYI.mjs';
import 'clsx';
import 'html-escaper';

const NOOP_MIDDLEWARE_FN = async (_ctx, next) => {
  const response = await next();
  response.headers.set(NOOP_MIDDLEWARE_HEADER, "true");
  return response;
};

const codeToStatusMap = {
  // Implemented from tRPC error code table
  // https://trpc.io/docs/server/error-handling#error-codes
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TIMEOUT: 405,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  INTERNAL_SERVER_ERROR: 500
};
Object.entries(codeToStatusMap).reduce(
  // reverse the key-value pairs
  (acc, [key, value]) => ({ ...acc, [value]: key }),
  {}
);

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///Users/junkawasaki/gftdcojp/dekigoto/docs/","adapterName":"","routes":[{"file":"file:///Users/junkawasaki/gftdcojp/dekigoto/docs/dist/_astro/ec.d6kn2.css","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_astro/ec.d6kn2.css","pattern":"^\\/_astro\\/ec\\.d6kn2\\.css$","segments":[[{"content":"_astro","dynamic":false,"spread":false}],[{"content":"ec.d6kn2.css","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro-expressive-code/routes/styles.ts","pathname":"/_astro/ec.d6kn2.css","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"file:///Users/junkawasaki/gftdcojp/dekigoto/docs/dist/_astro/ec.dy9ns.js","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_astro/ec.dy9ns.js","pattern":"^\\/_astro\\/ec\\.dy9ns\\.js$","segments":[[{"content":"_astro","dynamic":false,"spread":false}],[{"content":"ec.dy9ns.js","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro-expressive-code/routes/scripts.ts","pathname":"/_astro/ec.dy9ns.js","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"file:///Users/junkawasaki/gftdcojp/dekigoto/docs/dist/404.html","links":[],"scripts":[],"styles":[],"routeData":{"type":"page","isIndex":false,"route":"/404","pattern":"^\\/404\\/?$","segments":[[{"content":"404","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/@astrojs/starlight/404.astro","pathname":"/404","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}}],"base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["\u0000astro:content",{"propagation":"in-tree","containsHead":false}],["/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@astrojs/starlight/404.astro",{"propagation":"in-tree","containsHead":true}],["\u0000@astro-page:node_modules/@astrojs/starlight/404@_@astro",{"propagation":"in-tree","containsHead":false}],["/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@astrojs/starlight/utils/routing.ts",{"propagation":"in-tree","containsHead":false}],["/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@astrojs/starlight/index.astro",{"propagation":"in-tree","containsHead":true}],["\u0000@astro-page:node_modules/@astrojs/starlight/index@_@astro",{"propagation":"in-tree","containsHead":false}],["/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@astrojs/starlight/utils/navigation.ts",{"propagation":"in-tree","containsHead":false}],["/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@astrojs/starlight/components/SidebarSublist.astro",{"propagation":"in-tree","containsHead":false}],["/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@astrojs/starlight/components/Sidebar.astro",{"propagation":"in-tree","containsHead":false}],["\u0000virtual:starlight/components/Sidebar",{"propagation":"in-tree","containsHead":false}],["/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@astrojs/starlight/components/Page.astro",{"propagation":"in-tree","containsHead":false}],["/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@astrojs/starlight/utils/route-data.ts",{"propagation":"in-tree","containsHead":false}],["/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@astrojs/starlight/utils/translations.ts",{"propagation":"in-tree","containsHead":false}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(o,t)=>{let i=async()=>{await(await o())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var s=(i,t)=>{let a=async()=>{await(await i())()};if(t.value){let e=matchMedia(t.value);e.matches?a():e.addEventListener(\"change\",a,{once:!0})}};(self.Astro||(self.Astro={})).media=s;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var l=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let a of e)if(a.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=l;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000noop-middleware":"_noop-middleware.mjs","\u0000@astro-page:node_modules/astro-expressive-code/routes/styles@_@ts":"pages/_astro/ec.d6kn2.css.astro.mjs","\u0000@astro-page:node_modules/astro-expressive-code/routes/scripts@_@ts":"pages/_astro/ec.dy9ns.js.astro.mjs","\u0000@astro-page:node_modules/@astrojs/starlight/404@_@astro":"pages/404.astro.mjs","\u0000@astro-page:node_modules/@astrojs/starlight/index@_@astro":"pages/_---slug_.astro.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astrojs-manifest":"manifest_Bqu3lqTn.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/api/configuration.md?astroContentCollectionEntry=true":"chunks/configuration_Bg9Al-H4.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/architecture/merkle-dag.md?astroContentCollectionEntry=true":"chunks/merkle-dag_o9MM0uxa.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/architecture/process-network.md?astroContentCollectionEntry=true":"chunks/process-network_B687Qz1Q.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/components/eventstore.md?astroContentCollectionEntry=true":"chunks/eventstore_BzWinQYP.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/components/security-gateway.md?astroContentCollectionEntry=true":"chunks/security-gateway_CXDO6YoY.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/getting-started/installation.md?astroContentCollectionEntry=true":"chunks/installation_C3ql3qFp.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/getting-started/overview.md?astroContentCollectionEntry=true":"chunks/overview_DrpME8jK.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/getting-started/quick-start.md?astroContentCollectionEntry=true":"chunks/quick-start_ipl_U73c.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/index.md?astroContentCollectionEntry=true":"chunks/index_BU8on2IL.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/api/configuration.md?astroPropagatedAssets":"chunks/configuration_pBSCvpyu.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/architecture/merkle-dag.md?astroPropagatedAssets":"chunks/merkle-dag_BrMqKXLO.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/architecture/process-network.md?astroPropagatedAssets":"chunks/process-network_DEn9uAeZ.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/components/eventstore.md?astroPropagatedAssets":"chunks/eventstore_GcrYHBnw.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/components/security-gateway.md?astroPropagatedAssets":"chunks/security-gateway_DZEltasD.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/getting-started/installation.md?astroPropagatedAssets":"chunks/installation_BZmieOsh.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/getting-started/overview.md?astroPropagatedAssets":"chunks/overview_Dg6eyc7H.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/getting-started/quick-start.md?astroPropagatedAssets":"chunks/quick-start_CrDcXOU3.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/index.md?astroPropagatedAssets":"chunks/index_Dft4d7OO.mjs","\u0000astro:asset-imports":"chunks/_astro_asset-imports_D9aVaOQr.mjs","\u0000astro:data-layer-content":"chunks/_astro_data-layer-content_BcEe_9wP.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/api/configuration.md":"chunks/configuration_CsEN3gcY.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/architecture/merkle-dag.md":"chunks/merkle-dag_jqJBFPF4.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/architecture/process-network.md":"chunks/process-network_D0apDgwr.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/components/eventstore.md":"chunks/eventstore_B7X6Y4zt.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/components/security-gateway.md":"chunks/security-gateway_CD0hZe7_.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/getting-started/installation.md":"chunks/installation_C0kmzDvP.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/getting-started/overview.md":"chunks/overview_DGdM5oI2.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/getting-started/quick-start.md":"chunks/quick-start_D8OGSFgL.mjs","/Users/junkawasaki/gftdcojp/dekigoto/docs/src/content/docs/index.md":"chunks/index_DpE81DIu.mjs","/astro/hoisted.js?q=0":"_astro/hoisted.CkhA6hMU.js","astro:scripts/page.js":"_astro/page.7qqag-5g.js","/Users/junkawasaki/gftdcojp/dekigoto/docs/node_modules/@pagefind/default-ui/npm_dist/mjs/ui-core.mjs":"_astro/ui-core.B_9o0SD2.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[],"assets":["/_astro/page.7qqag-5g.js","/file:///Users/junkawasaki/gftdcojp/dekigoto/docs/dist/_astro/ec.d6kn2.css","/file:///Users/junkawasaki/gftdcojp/dekigoto/docs/dist/_astro/ec.dy9ns.js","/file:///Users/junkawasaki/gftdcojp/dekigoto/docs/dist/404.html"],"buildFormat":"directory","checkOrigin":false,"serverIslandNameMap":[],"key":"ZrGbb6SX07Ud9p2/bcL5UsX6TVizeU7tN9uFPJh3BiI=","experimentalEnvGetSecretEnabled":false});

export { manifest };
