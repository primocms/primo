import _ from "lodash";
import axios from "axios";
import { getContext } from "svelte";
import { get } from "svelte/store";
import ShortUniqueId from "short-unique-id";
import objectPath from "object-path";

import {id, dependencies as pageDependencies, wrapper as pageWrapper} from './stores/app/activePage'
import user from './stores/data/user'
import {getAllFields} from './stores/helpers'
import {functions} from './functions'

let Handlebars;
export async function parseHandlebars(code, data) {
  if (!Handlebars) {
    Handlebars = await import("handlebars/dist/handlebars.min.js");
  }
  let res 
  try {
    const template = Handlebars.compile(code);
    res = template(data);
  } catch(e) {
    const error = e.toString().replace(/\n/g, "<br />")
    res = `<pre class="flex justify-start p-8 items-center bg-red-100 text-red-900 h-screen font-mono text-xs lg:text-sm xl:text-md">${error}</pre>`
  }
  return res
}

export async function convertFieldsToData(fields) {
  let literalValueFields = fields
    .map((f) => ({
      key: f.key,
      value: f.type === "number" ? parseInt(f.value) : f.value,
    }))
    .reduce((obj, item) => ((obj[item.key] = item.value), obj), {});

  const parsedFields = fields.map((field) => {
    if (field.type === "group") {
      if (field.fields) {
        field.value = _.chain(field.fields)
          .keyBy("key")
          .mapValues("value")
          .value();
      }
    }
    return field;
  })

  return _.chain(parsedFields).keyBy("key").mapValues("value").value();
}

export function scrambleIds(content) {
  let IDs = [];
  const newContent = content.map((section) => {
    const newID = getUniqueId();
    IDs.push([section.id, newID]);
    return {
      ...section,
      id: newID,
      columns: section.columns.map((column) => {
        const newID = getUniqueId();
        IDs.push([column.id, newID]);
        return {
          ...column,
          id: newID,
          rows: column.rows.map((row) => {
            const newID = getUniqueId();
            IDs.push([row.id, newID]);
            return {
              ...row,
              id: newID,
            };
          }),
        };
      }),
    };
  });
  return [newContent, IDs];
}

// Lets us debounce from reactive statements
export function createDebouncer(time) {
  return _.debounce((val) => {
    const [fn, arg] = val;
    fn(arg);
  }, time);
}

export function getUniqueId() {
  return new ShortUniqueId().randomUUID(5).toLowerCase();
}

export function createSymbolPreview({ id, wrapper, html, css, js }) {
  return `<head>${wrapper.head.final}</head><div id="component-${id}">${html}</div><style>${css}</style><script type="module">${js}</script>${wrapper.below.final}`;
}

export function wrapInStyleTags(css, id = null) {
  return `<style type="text/css" ${id ? `id = "${id}"` : ""}>${css}</style>`;
}


export function buildPagePreview(content) {
  let html = "";
  content.forEach((section) => {
    html +=
      `<div id="section-${section.id}">\n` +
      `\t<div class="columns flex flex-wrap ${
        section.width === "contained" ? "container" : ""
      }">\n`;
    section.columns.forEach((column) => {
      html += `\t\t<div class="column ${column.size}" id="column-${column.id}">\n`;
      column.rows.forEach((row) => {
        html +=
          row.type === "component"
            ? `\t\t\t<div class="primo-component">\n` +
              `\t\t\t\t<div id="component-${row.id}" class="w-full">${row.value.final.html}</div>\n` +
              `\t\t\t\t<script>${row.value.final.js}</script>\n` +
              `\t\t\t\t<style>${row.value.final.css}</style>\n` +
              `\t\t\t</div>\n`
            : `\t\t\t<div class="primo-content" id="content-${row.id}">\n` +
              `\t\t\t\t${row.value.html}\n` +
              `\t\t\t</div>\n`;
      });
      html += `\t\t</div>\n`;
    });
    html += `\t</div>\n` + `</section>\n`;
  });

  // html += get(site).styles // TODO

  return html;
}

export async function hydrateAllComponents(content) {
  return await Promise.all(
    content.map(async (section) => ({
      ...section,
      columns: await Promise.all(
        section.columns.map(async (column) => ({
          ...column,
          rows: await Promise.all(
            column.rows.map(async (row) => {
              if (row.type === "content") return row;
              else return hydrateComponent(row);
            })
          ),
        }))
      ),
    }))
  );
}

export async function hydrateComponent(component) {
  const { value } = component;
  const fields = getAllFields(component);
  const data = await convertFieldsToData(fields, "all");
  const finalHTML = await parseHandlebars(value.raw.html, data);
  component.value.final.html = finalHTML;
  return component;
}

export function duplicatePage(page, title, url) {
  const newPage = _.cloneDeep(page);
  const [newContent, IDmap] = scrambleIds(page.content);
  newPage.content = newContent;
  newPage.title = title;
  newPage.id = url;

  // Replace all the old IDs in the page styles with the new IDs
  let rawPageStyles = newPage.styles.raw;
  let finalPageStyles = newPage.styles.final;
  IDmap.forEach(([oldID, newID]) => {
    newPage.styles.raw = rawPageStyles.replace(new RegExp(oldID, "g"), newID);
    newPage.styles.final = finalPageStyles.replace(
      new RegExp(oldID, "g"),
      newID
    );
  });

  // Replace all the old IDs in the components
  IDmap.forEach(([oldID, newID]) => {
    newPage.content = newPage.content.map((section) => ({
      ...section,
      columns: section.columns.map((column) => ({
        ...column,
        rows: column.rows.map((row) =>
          row.type === "component"
            ? {
                ...row,
                value: {
                  ...row.value,
                  raw: {
                    ...row.value.raw,
                    css: row.value.raw.css.replace(
                      new RegExp(oldID, "g"),
                      newID
                    ),
                  },
                  final: {
                    ...row.value.final,
                    css: row.value.final.css.replace(
                      new RegExp(oldID, "g"),
                      newID
                    ),
                  },
                },
              }
            : row
        ),
      })),
    }));
  });
  return newPage;
}
