import{i as r,j as i,k as o,u as m,n as _,s as l,e as y,p as g,P as b}from"./modal.DQW4ZWZ4.js";async function d(e,s){const a=[...r(s).map(n=>n.id),e];let[{data:t},{data:p}]=await Promise.all([i.from("sections").select("*, entries(*)").eq("symbol",s).not("id","in",`(${a.join(",")})`),i.from("sections").select("*, entries(*), master!inner(symbol)").eq("master.symbol",s)]);return[...t||[],...p||[]].map(n=>({...n,entries:n.entries||[]}))}async function f(e){const s=r(e).map(t=>t.id);let[{data:c},{data:a}]=await Promise.all([i.from("sections").select("*, entries(*), symbol").eq("symbol",e).not("id","in",`(${Object.keys(s).join(",")})`),i.from("sections").select("*, entries(*), master!inner(symbol)").eq("master.symbol",e)]);return[...c||[],...a||[]].map(t=>({...t,entries:t.entries||[]}))}async function k(e){o.pages.set(e.pages),o.page_types.set(e.page_types),o.symbols.set(e.symbols),m(e.site)}function h(e){y.update(s=>({...s,id:e.id,name:e.name,slug:e.slug,entries:e.entries,page_type:e.page_type,parent:e.parent})),l.set(e.sections),g.set(!0),_.set(b())}async function j(e){_.set(e),l.set(e.sections)}export{j as a,k as b,d as c,f as g,h};
