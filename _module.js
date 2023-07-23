function noop() { }
function assign(tar, src) {
    // @ts-ignore
    for (const k in src)
        tar[k] = src[k];
    return tar;
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
let src_url_equal_anchor;
function src_url_equal(element_src, url) {
    if (!src_url_equal_anchor) {
        src_url_equal_anchor = document.createElement('a');
    }
    src_url_equal_anchor.href = url;
    return element_src === src_url_equal_anchor.href;
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function exclude_internal_props(props) {
    const result = {};
    for (const k in props)
        if (k[0] !== '$')
            result[k] = props[k];
    return result;
}

// Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
// at the end of hydration without touching the remaining nodes.
let is_hydrating = false;
function start_hydrating() {
    is_hydrating = true;
}
function end_hydrating() {
    is_hydrating = false;
}
function upper_bound(low, high, key, value) {
    // Return first index of value larger than input value in the range [low, high)
    while (low < high) {
        const mid = low + ((high - low) >> 1);
        if (key(mid) <= value) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    return low;
}
function init_hydrate(target) {
    if (target.hydrate_init)
        return;
    target.hydrate_init = true;
    // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
    let children = target.childNodes;
    // If target is <head>, there may be children without claim_order
    if (target.nodeName === 'HEAD') {
        const myChildren = [];
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (node.claim_order !== undefined) {
                myChildren.push(node);
            }
        }
        children = myChildren;
    }
    /*
    * Reorder claimed children optimally.
    * We can reorder claimed children optimally by finding the longest subsequence of
    * nodes that are already claimed in order and only moving the rest. The longest
    * subsequence of nodes that are claimed in order can be found by
    * computing the longest increasing subsequence of .claim_order values.
    *
    * This algorithm is optimal in generating the least amount of reorder operations
    * possible.
    *
    * Proof:
    * We know that, given a set of reordering operations, the nodes that do not move
    * always form an increasing subsequence, since they do not move among each other
    * meaning that they must be already ordered among each other. Thus, the maximal
    * set of nodes that do not move form a longest increasing subsequence.
    */
    // Compute longest increasing subsequence
    // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
    const m = new Int32Array(children.length + 1);
    // Predecessor indices + 1
    const p = new Int32Array(children.length);
    m[0] = -1;
    let longest = 0;
    for (let i = 0; i < children.length; i++) {
        const current = children[i].claim_order;
        // Find the largest subsequence length such that it ends in a value less than our current value
        // upper_bound returns first greater value, so we subtract one
        // with fast path for when we are on the current longest subsequence
        const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
        p[i] = m[seqLen] + 1;
        const newLen = seqLen + 1;
        // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
        m[newLen] = i;
        longest = Math.max(newLen, longest);
    }
    // The longest increasing subsequence of nodes (initially reversed)
    const lis = [];
    // The rest of the nodes, nodes that will be moved
    const toMove = [];
    let last = children.length - 1;
    for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
        lis.push(children[cur - 1]);
        for (; last >= cur; last--) {
            toMove.push(children[last]);
        }
        last--;
    }
    for (; last >= 0; last--) {
        toMove.push(children[last]);
    }
    lis.reverse();
    // We sort the nodes being moved to guarantee that their insertion order matches the claim order
    toMove.sort((a, b) => a.claim_order - b.claim_order);
    // Finally, we move the nodes
    for (let i = 0, j = 0; i < toMove.length; i++) {
        while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
            j++;
        }
        const anchor = j < lis.length ? lis[j] : null;
        target.insertBefore(toMove[i], anchor);
    }
}
function append_hydration(target, node) {
    if (is_hydrating) {
        init_hydrate(target);
        if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentNode !== target))) {
            target.actual_end_child = target.firstChild;
        }
        // Skip nodes of undefined ordering
        while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
            target.actual_end_child = target.actual_end_child.nextSibling;
        }
        if (node !== target.actual_end_child) {
            // We only insert if the ordering of this node should be modified or the parent node is not target
            if (node.claim_order !== undefined || node.parentNode !== target) {
                target.insertBefore(node, target.actual_end_child);
            }
        }
        else {
            target.actual_end_child = node.nextSibling;
        }
    }
    else if (node.parentNode !== target || node.nextSibling !== null) {
        target.appendChild(node);
    }
}
function insert_hydration(target, node, anchor) {
    if (is_hydrating && !anchor) {
        append_hydration(target, node);
    }
    else if (node.parentNode !== target || node.nextSibling != anchor) {
        target.insertBefore(node, anchor || null);
    }
}
function detach(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
/**
 * List of attributes that should always be set through the attr method,
 * because updating them through the property setter doesn't work reliably.
 * In the example of `width`/`height`, the problem is that the setter only
 * accepts numeric values, but the attribute can also be set to a string like `50%`.
 * If this list becomes too big, rethink this approach.
 */
const always_set_through_set_attribute = ['width', 'height'];
function set_attributes(node, attributes) {
    // @ts-ignore
    const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
    for (const key in attributes) {
        if (attributes[key] == null) {
            node.removeAttribute(key);
        }
        else if (key === 'style') {
            node.style.cssText = attributes[key];
        }
        else if (key === '__value') {
            node.value = node[key] = attributes[key];
        }
        else if (descriptors[key] && descriptors[key].set && always_set_through_set_attribute.indexOf(key) === -1) {
            node[key] = attributes[key];
        }
        else {
            attr(node, key, attributes[key]);
        }
    }
}
function set_svg_attributes(node, attributes) {
    for (const key in attributes) {
        attr(node, key, attributes[key]);
    }
}
function children(element) {
    return Array.from(element.childNodes);
}
function init_claim_info(nodes) {
    if (nodes.claim_info === undefined) {
        nodes.claim_info = { last_index: 0, total_claimed: 0 };
    }
}
function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
    // Try to find nodes in an order such that we lengthen the longest increasing subsequence
    init_claim_info(nodes);
    const resultNode = (() => {
        // We first try to find an element after the previous one
        for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                return node;
            }
        }
        // Otherwise, we try to find one before
        // We iterate in reverse so that we don't go too far back
        for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                else if (replacement === undefined) {
                    // Since we spliced before the last_index, we decrease it
                    nodes.claim_info.last_index--;
                }
                return node;
            }
        }
        // If we can't find any matching node, we create a new one
        return createNode();
    })();
    resultNode.claim_order = nodes.claim_info.total_claimed;
    nodes.claim_info.total_claimed += 1;
    return resultNode;
}
function claim_element_base(nodes, name, attributes, create_element) {
    return claim_node(nodes, (node) => node.nodeName === name, (node) => {
        const remove = [];
        for (let j = 0; j < node.attributes.length; j++) {
            const attribute = node.attributes[j];
            if (!attributes[attribute.name]) {
                remove.push(attribute.name);
            }
        }
        remove.forEach(v => node.removeAttribute(v));
        return undefined;
    }, () => create_element(name));
}
function claim_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, element);
}
function claim_svg_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, svg_element);
}
function claim_text(nodes, data) {
    return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
        const dataStr = '' + data;
        if (node.data.startsWith(dataStr)) {
            if (node.data.length !== dataStr.length) {
                return node.splitText(dataStr.length);
            }
        }
        else {
            node.data = dataStr;
        }
    }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
    );
}
function claim_space(nodes) {
    return claim_text(nodes, ' ');
}
function set_data(text, data) {
    data = '' + data;
    if (text.data === data)
        return;
    text.data = data;
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, bubbles, cancelable, detail);
    return e;
}
function head_selector(nodeId, head) {
    const result = [];
    let started = 0;
    for (const node of head.childNodes) {
        if (node.nodeType === 8 /* comment node */) {
            const comment = node.textContent.trim();
            if (comment === `HEAD_${nodeId}_END`) {
                started -= 1;
                result.push(node);
            }
            else if (comment === `HEAD_${nodeId}_START`) {
                started += 1;
                result.push(node);
            }
        }
        else if (started > 0) {
            result.push(node);
        }
    }
    return result;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
/**
 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
 * it can be called from an external module).
 *
 * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
 *
 * https://svelte.dev/docs#run-time-svelte-onmount
 */
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
/**
 * Schedules a callback to run immediately before the component is unmounted.
 *
 * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
 * only one that runs inside a server-side component.
 *
 * https://svelte.dev/docs#run-time-svelte-ondestroy
 */
function onDestroy(fn) {
    get_current_component().$$.on_destroy.push(fn);
}
/**
 * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
 * Event dispatchers are functions that can take two arguments: `name` and `detail`.
 *
 * Component events created with `createEventDispatcher` create a
 * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
 * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
 * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
 * property and can contain any type of data.
 *
 * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
 */
function createEventDispatcher() {
    const component = get_current_component();
    return (type, detail, { cancelable = false } = {}) => {
        const callbacks = component.$$.callbacks[type];
        if (callbacks) {
            // TODO are there situations where events could be dispatched
            // in a server (non-DOM) environment?
            const event = custom_event(type, detail, { cancelable });
            callbacks.slice().forEach(fn => {
                fn.call(component, event);
            });
            return !event.defaultPrevented;
        }
        return true;
    };
}

const dirty_components = [];
const binding_callbacks = [];
let render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = /* @__PURE__ */ Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    // Do not reenter flush while dirty components are updated, as this can
    // result in an infinite loop. Instead, let the inner flush handle it.
    // Reentrancy is ok afterwards for bindings etc.
    if (flushidx !== 0) {
        return;
    }
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        try {
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
        }
        catch (e) {
            // reset dirty state to not end up in a deadlocked state and then rethrow
            dirty_components.length = 0;
            flushidx = 0;
            throw e;
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    seen_callbacks.clear();
    set_current_component(saved_component);
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 */
function flush_render_callbacks(fns) {
    const filtered = [];
    const targets = [];
    render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
    targets.forEach((c) => c());
    render_callbacks = filtered;
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
    else if (callback) {
        callback();
    }
}

function get_spread_update(levels, updates) {
    const update = {};
    const to_null_out = {};
    const accounted_for = { $$scope: 1 };
    let i = levels.length;
    while (i--) {
        const o = levels[i];
        const n = updates[i];
        if (n) {
            for (const key in o) {
                if (!(key in n))
                    to_null_out[key] = 1;
            }
            for (const key in n) {
                if (!accounted_for[key]) {
                    update[key] = n[key];
                    accounted_for[key] = 1;
                }
            }
            levels[i] = n;
        }
        else {
            for (const key in o) {
                accounted_for[key] = 1;
            }
        }
    }
    for (const key in to_null_out) {
        if (!(key in update))
            update[key] = undefined;
    }
    return update;
}
function create_component(block) {
    block && block.c();
}
function claim_component(block, parent_nodes) {
    block && block.l(parent_nodes);
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
            // if the component was destroyed immediately
            // it will update the `$$.on_destroy` reference to `null`.
            // the destructured on_destroy may still reference to the old array
            if (component.$$.on_destroy) {
                component.$$.on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        flush_render_callbacks($$.after_update);
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: [],
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            start_hydrating();
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        end_hydrating();
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        if (!is_function(callback)) {
            return noop;
        }
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/* generated by Svelte v3.58.0 */

function create_fragment(ctx) {
	let meta0;
	let meta1;
	let link0;
	let link0_href_value;
	let link1;
	let title_value;
	let meta2;
	let style;
	let t;
	document.title = title_value = /*title*/ ctx[1];

	return {
		c() {
			meta0 = element("meta");
			meta1 = element("meta");
			link0 = element("link");
			link1 = element("link");
			meta2 = element("meta");
			style = element("style");
			t = text("/* Reset & standardize default styles */\n@import url(\"https://unpkg.com/@primo-app/primo@1.3.64/reset.css\") layer;\n\n/* Design tokens (apply to components) */\n:root {\n  /* Custom theme options */\n  --color-accent: #5a5a5a;\n  --font-primary: \"Bespoke Serif\", serif;\n  --font-secondary: \"Open Sans\", sans-serif;\n\n  /* Base values */\n  --box-shadow: 0px 4px 30px rgba(0, 0, 0, 0.2);\n  --border-radius: 8px;\n  --border-color: #cbcace;\n}\n\n/* Root element (use instead of `body`) */\n#page {\n  font-family: var(--font-secondary), system-ui, sans-serif;\n  color: #222;\n  line-height: 1.5;\n  font-size: 1.125rem;\n  background: white;\n}\n\n/* Elements */\n.section-container {\n  max-width: 900px;\n  margin: 0 auto;\n  padding: 4rem 2rem;\n}\n\na.link {\n  line-height: 1.25;\n  font-weight: 400;\n  border-bottom: 2px solid var(--color-accent, rebeccapurple);\n  transform: translateY(-2px); /* move link back into place */\n  transition: var(--transition, 0.1s border);\n}\n\na.link:hover {\n    border-color: transparent;\n  }\n\n.heading {\n  font-family: var(--font-primary);\n  font-size: 2rem;\n  line-height: 1.15;\n  font-weight: 500;\n  margin-bottom: 1.25rem;\n}\n\n.button {\n  color: white;\n  background: var(--color-accent, rebeccapurple);\n  border-radius: 5px;\n  padding: 8px 20px;\n  transition: var(--transition, 0.1s box-shadow);\n  border: 0;\n}\n\n/* reset */\n\n.button:hover {\n    box-shadow: 0 0 0 2px var(--color-accent, rebeccapurple);\n  }\n\n.button.inverted {\n    background: transparent;\n    color: var(--color-accent, rebeccapurple);\n  }\n\n/* Content Section */\n.section .content {\n  max-width: 900px;\n  margin: 0 auto;\n  padding: 4rem 2rem;\n}\n.section .content p {\n    padding: 0.25rem 0;\n  }\n.section .content img {\n    width: 100%;\n    margin: 2rem 0;\n    box-shadow: var(--box-shadow);\n    border-radius: var(--border-radius);\n  }\n.section .content a.link {\n  }\n.section .content h1 {\n    font-family: var(--font-primary);\n    font-size: 3rem;\n    font-weight: 500;\n    margin-bottom: 1rem;\n  }\n.section .content h2 {\n    font-family: var(--font-primary);\n    font-size: 2rem;\n    font-weight: 500;\n    margin-bottom: 1rem;\n  }\n.section .content h3 {\n    font-family: var(--font-primary);\n    font-size: 1.5rem;\n    font-weight: 500;\n    margin-bottom: 0.5rem;\n  }\n.section .content ul {\n    list-style: disc;\n    padding: 0.5rem 0;\n    padding-left: 1.25rem;\n  }\n.section .content ol {\n    list-style: decimal;\n    padding: 0.5rem 0;\n    padding-left: 1.25rem;\n  }\n.section .content blockquote {\n    padding: 2rem;\n    box-shadow: var(--box-shadow);\n    border-radius: var(--border-radius);\n  }\nsection.has-content {\n  background: var(--background);\n}");
			this.h();
		},
		l(nodes) {
			const head_nodes = head_selector('svelte-xwprd8', document.head);
			meta0 = claim_element(head_nodes, "META", { name: true, content: true });
			meta1 = claim_element(head_nodes, "META", { charset: true });

			link0 = claim_element(head_nodes, "LINK", {
				rel: true,
				type: true,
				sizes: true,
				href: true
			});

			link1 = claim_element(head_nodes, "LINK", { href: true, rel: true });
			meta2 = claim_element(head_nodes, "META", { name: true, content: true });
			style = claim_element(head_nodes, "STYLE", {});
			var style_nodes = children(style);
			t = claim_text(style_nodes, "/* Reset & standardize default styles */\n@import url(\"https://unpkg.com/@primo-app/primo@1.3.64/reset.css\") layer;\n\n/* Design tokens (apply to components) */\n:root {\n  /* Custom theme options */\n  --color-accent: #5a5a5a;\n  --font-primary: \"Bespoke Serif\", serif;\n  --font-secondary: \"Open Sans\", sans-serif;\n\n  /* Base values */\n  --box-shadow: 0px 4px 30px rgba(0, 0, 0, 0.2);\n  --border-radius: 8px;\n  --border-color: #cbcace;\n}\n\n/* Root element (use instead of `body`) */\n#page {\n  font-family: var(--font-secondary), system-ui, sans-serif;\n  color: #222;\n  line-height: 1.5;\n  font-size: 1.125rem;\n  background: white;\n}\n\n/* Elements */\n.section-container {\n  max-width: 900px;\n  margin: 0 auto;\n  padding: 4rem 2rem;\n}\n\na.link {\n  line-height: 1.25;\n  font-weight: 400;\n  border-bottom: 2px solid var(--color-accent, rebeccapurple);\n  transform: translateY(-2px); /* move link back into place */\n  transition: var(--transition, 0.1s border);\n}\n\na.link:hover {\n    border-color: transparent;\n  }\n\n.heading {\n  font-family: var(--font-primary);\n  font-size: 2rem;\n  line-height: 1.15;\n  font-weight: 500;\n  margin-bottom: 1.25rem;\n}\n\n.button {\n  color: white;\n  background: var(--color-accent, rebeccapurple);\n  border-radius: 5px;\n  padding: 8px 20px;\n  transition: var(--transition, 0.1s box-shadow);\n  border: 0;\n}\n\n/* reset */\n\n.button:hover {\n    box-shadow: 0 0 0 2px var(--color-accent, rebeccapurple);\n  }\n\n.button.inverted {\n    background: transparent;\n    color: var(--color-accent, rebeccapurple);\n  }\n\n/* Content Section */\n.section .content {\n  max-width: 900px;\n  margin: 0 auto;\n  padding: 4rem 2rem;\n}\n.section .content p {\n    padding: 0.25rem 0;\n  }\n.section .content img {\n    width: 100%;\n    margin: 2rem 0;\n    box-shadow: var(--box-shadow);\n    border-radius: var(--border-radius);\n  }\n.section .content a.link {\n  }\n.section .content h1 {\n    font-family: var(--font-primary);\n    font-size: 3rem;\n    font-weight: 500;\n    margin-bottom: 1rem;\n  }\n.section .content h2 {\n    font-family: var(--font-primary);\n    font-size: 2rem;\n    font-weight: 500;\n    margin-bottom: 1rem;\n  }\n.section .content h3 {\n    font-family: var(--font-primary);\n    font-size: 1.5rem;\n    font-weight: 500;\n    margin-bottom: 0.5rem;\n  }\n.section .content ul {\n    list-style: disc;\n    padding: 0.5rem 0;\n    padding-left: 1.25rem;\n  }\n.section .content ol {\n    list-style: decimal;\n    padding: 0.5rem 0;\n    padding-left: 1.25rem;\n  }\n.section .content blockquote {\n    padding: 2rem;\n    box-shadow: var(--box-shadow);\n    border-radius: var(--border-radius);\n  }\nsection.has-content {\n  background: var(--background);\n}");
			style_nodes.forEach(detach);
			head_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(meta0, "name", "viewport");
			attr(meta0, "content", "width=device-width, initial-scale=1.0");
			attr(meta1, "charset", "UTF-8");
			attr(link0, "rel", "icon");
			attr(link0, "type", "image/png");
			attr(link0, "sizes", "32x32");
			attr(link0, "href", link0_href_value = /*favicon*/ ctx[0].url);
			attr(link1, "href", "https://api.fontshare.com/v2/css?f[]=bespoke-serif@400,700,401,300,500,501,701,301&display=swap");
			attr(link1, "rel", "stylesheet");
			attr(meta2, "name", "description");
			attr(meta2, "content", /*description*/ ctx[2]);
		},
		m(target, anchor) {
			append_hydration(document.head, meta0);
			append_hydration(document.head, meta1);
			append_hydration(document.head, link0);
			append_hydration(document.head, link1);
			append_hydration(document.head, meta2);
			append_hydration(document.head, style);
			append_hydration(style, t);
		},
		p(ctx, [dirty]) {
			if (dirty & /*favicon*/ 1 && link0_href_value !== (link0_href_value = /*favicon*/ ctx[0].url)) {
				attr(link0, "href", link0_href_value);
			}

			if (dirty & /*title*/ 2 && title_value !== (title_value = /*title*/ ctx[1])) {
				document.title = title_value;
			}

			if (dirty & /*description*/ 4) {
				attr(meta2, "content", /*description*/ ctx[2]);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			detach(meta0);
			detach(meta1);
			detach(link0);
			detach(link1);
			detach(meta2);
			detach(style);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { favicon } = $$props;
	let { site_nav } = $$props;
	let { title } = $$props;
	let { description } = $$props;

	$$self.$$set = $$props => {
		if ('favicon' in $$props) $$invalidate(0, favicon = $$props.favicon);
		if ('site_nav' in $$props) $$invalidate(3, site_nav = $$props.site_nav);
		if ('title' in $$props) $$invalidate(1, title = $$props.title);
		if ('description' in $$props) $$invalidate(2, description = $$props.description);
	};

	return [favicon, title, description, site_nav];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance, create_fragment, safe_not_equal, {
			favicon: 0,
			site_nav: 3,
			title: 1,
			description: 2
		});
	}
}

const matchIconName = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const stringToIcon = (value, validate, allowSimpleName, provider = "") => {
  const colonSeparated = value.split(":");
  if (value.slice(0, 1) === "@") {
    if (colonSeparated.length < 2 || colonSeparated.length > 3) {
      return null;
    }
    provider = colonSeparated.shift().slice(1);
  }
  if (colonSeparated.length > 3 || !colonSeparated.length) {
    return null;
  }
  if (colonSeparated.length > 1) {
    const name2 = colonSeparated.pop();
    const prefix = colonSeparated.pop();
    const result = {
      provider: colonSeparated.length > 0 ? colonSeparated[0] : provider,
      prefix,
      name: name2
    };
    return validate && !validateIconName(result) ? null : result;
  }
  const name = colonSeparated[0];
  const dashSeparated = name.split("-");
  if (dashSeparated.length > 1) {
    const result = {
      provider,
      prefix: dashSeparated.shift(),
      name: dashSeparated.join("-")
    };
    return validate && !validateIconName(result) ? null : result;
  }
  if (allowSimpleName && provider === "") {
    const result = {
      provider,
      prefix: "",
      name
    };
    return validate && !validateIconName(result, allowSimpleName) ? null : result;
  }
  return null;
};
const validateIconName = (icon, allowSimpleName) => {
  if (!icon) {
    return false;
  }
  return !!((icon.provider === "" || icon.provider.match(matchIconName)) && (allowSimpleName && icon.prefix === "" || icon.prefix.match(matchIconName)) && icon.name.match(matchIconName));
};
const defaultIconDimensions = Object.freeze({
  left: 0,
  top: 0,
  width: 16,
  height: 16
});
const defaultIconTransformations = Object.freeze({
  rotate: 0,
  vFlip: false,
  hFlip: false
});
const defaultIconProps = Object.freeze({
  ...defaultIconDimensions,
  ...defaultIconTransformations
});
const defaultExtendedIconProps = Object.freeze({
  ...defaultIconProps,
  body: "",
  hidden: false
});
function mergeIconTransformations(obj1, obj2) {
  const result = {};
  if (!obj1.hFlip !== !obj2.hFlip) {
    result.hFlip = true;
  }
  if (!obj1.vFlip !== !obj2.vFlip) {
    result.vFlip = true;
  }
  const rotate = ((obj1.rotate || 0) + (obj2.rotate || 0)) % 4;
  if (rotate) {
    result.rotate = rotate;
  }
  return result;
}
function mergeIconData(parent, child) {
  const result = mergeIconTransformations(parent, child);
  for (const key in defaultExtendedIconProps) {
    if (key in defaultIconTransformations) {
      if (key in parent && !(key in result)) {
        result[key] = defaultIconTransformations[key];
      }
    } else if (key in child) {
      result[key] = child[key];
    } else if (key in parent) {
      result[key] = parent[key];
    }
  }
  return result;
}
function getIconsTree(data, names) {
  const icons = data.icons;
  const aliases = data.aliases || /* @__PURE__ */ Object.create(null);
  const resolved = /* @__PURE__ */ Object.create(null);
  function resolve(name) {
    if (icons[name]) {
      return resolved[name] = [];
    }
    if (!(name in resolved)) {
      resolved[name] = null;
      const parent = aliases[name] && aliases[name].parent;
      const value = parent && resolve(parent);
      if (value) {
        resolved[name] = [parent].concat(value);
      }
    }
    return resolved[name];
  }
  (names || Object.keys(icons).concat(Object.keys(aliases))).forEach(resolve);
  return resolved;
}
function internalGetIconData(data, name, tree) {
  const icons = data.icons;
  const aliases = data.aliases || /* @__PURE__ */ Object.create(null);
  let currentProps = {};
  function parse(name2) {
    currentProps = mergeIconData(icons[name2] || aliases[name2], currentProps);
  }
  parse(name);
  tree.forEach(parse);
  return mergeIconData(data, currentProps);
}
function parseIconSet(data, callback) {
  const names = [];
  if (typeof data !== "object" || typeof data.icons !== "object") {
    return names;
  }
  if (data.not_found instanceof Array) {
    data.not_found.forEach((name) => {
      callback(name, null);
      names.push(name);
    });
  }
  const tree = getIconsTree(data);
  for (const name in tree) {
    const item = tree[name];
    if (item) {
      callback(name, internalGetIconData(data, name, item));
      names.push(name);
    }
  }
  return names;
}
const optionalPropertyDefaults = {
  provider: "",
  aliases: {},
  not_found: {},
  ...defaultIconDimensions
};
function checkOptionalProps(item, defaults) {
  for (const prop in defaults) {
    if (prop in item && typeof item[prop] !== typeof defaults[prop]) {
      return false;
    }
  }
  return true;
}
function quicklyValidateIconSet(obj) {
  if (typeof obj !== "object" || obj === null) {
    return null;
  }
  const data = obj;
  if (typeof data.prefix !== "string" || !obj.icons || typeof obj.icons !== "object") {
    return null;
  }
  if (!checkOptionalProps(obj, optionalPropertyDefaults)) {
    return null;
  }
  const icons = data.icons;
  for (const name in icons) {
    const icon = icons[name];
    if (!name.match(matchIconName) || typeof icon.body !== "string" || !checkOptionalProps(icon, defaultExtendedIconProps)) {
      return null;
    }
  }
  const aliases = data.aliases || /* @__PURE__ */ Object.create(null);
  for (const name in aliases) {
    const icon = aliases[name];
    const parent = icon.parent;
    if (!name.match(matchIconName) || typeof parent !== "string" || !icons[parent] && !aliases[parent] || !checkOptionalProps(icon, defaultExtendedIconProps)) {
      return null;
    }
  }
  return data;
}
const dataStorage = /* @__PURE__ */ Object.create(null);
function newStorage(provider, prefix) {
  return {
    provider,
    prefix,
    icons: /* @__PURE__ */ Object.create(null),
    missing: /* @__PURE__ */ new Set()
  };
}
function getStorage(provider, prefix) {
  const providerStorage = dataStorage[provider] || (dataStorage[provider] = /* @__PURE__ */ Object.create(null));
  return providerStorage[prefix] || (providerStorage[prefix] = newStorage(provider, prefix));
}
function addIconSet(storage2, data) {
  if (!quicklyValidateIconSet(data)) {
    return [];
  }
  return parseIconSet(data, (name, icon) => {
    if (icon) {
      storage2.icons[name] = icon;
    } else {
      storage2.missing.add(name);
    }
  });
}
function addIconToStorage(storage2, name, icon) {
  try {
    if (typeof icon.body === "string") {
      storage2.icons[name] = {...icon};
      return true;
    }
  } catch (err) {
  }
  return false;
}
let simpleNames = false;
function allowSimpleNames(allow) {
  if (typeof allow === "boolean") {
    simpleNames = allow;
  }
  return simpleNames;
}
function getIconData(name) {
  const icon = typeof name === "string" ? stringToIcon(name, true, simpleNames) : name;
  if (icon) {
    const storage2 = getStorage(icon.provider, icon.prefix);
    const iconName = icon.name;
    return storage2.icons[iconName] || (storage2.missing.has(iconName) ? null : void 0);
  }
}
function addIcon(name, data) {
  const icon = stringToIcon(name, true, simpleNames);
  if (!icon) {
    return false;
  }
  const storage2 = getStorage(icon.provider, icon.prefix);
  return addIconToStorage(storage2, icon.name, data);
}
function addCollection(data, provider) {
  if (typeof data !== "object") {
    return false;
  }
  if (typeof provider !== "string") {
    provider = data.provider || "";
  }
  if (simpleNames && !provider && !data.prefix) {
    let added = false;
    if (quicklyValidateIconSet(data)) {
      data.prefix = "";
      parseIconSet(data, (name, icon) => {
        if (icon && addIcon(name, icon)) {
          added = true;
        }
      });
    }
    return added;
  }
  const prefix = data.prefix;
  if (!validateIconName({
    provider,
    prefix,
    name: "a"
  })) {
    return false;
  }
  const storage2 = getStorage(provider, prefix);
  return !!addIconSet(storage2, data);
}
const defaultIconSizeCustomisations = Object.freeze({
  width: null,
  height: null
});
const defaultIconCustomisations = Object.freeze({
  ...defaultIconSizeCustomisations,
  ...defaultIconTransformations
});
const unitsSplit = /(-?[0-9.]*[0-9]+[0-9.]*)/g;
const unitsTest = /^-?[0-9.]*[0-9]+[0-9.]*$/g;
function calculateSize(size, ratio, precision) {
  if (ratio === 1) {
    return size;
  }
  precision = precision || 100;
  if (typeof size === "number") {
    return Math.ceil(size * ratio * precision) / precision;
  }
  if (typeof size !== "string") {
    return size;
  }
  const oldParts = size.split(unitsSplit);
  if (oldParts === null || !oldParts.length) {
    return size;
  }
  const newParts = [];
  let code = oldParts.shift();
  let isNumber = unitsTest.test(code);
  while (true) {
    if (isNumber) {
      const num = parseFloat(code);
      if (isNaN(num)) {
        newParts.push(code);
      } else {
        newParts.push(Math.ceil(num * ratio * precision) / precision);
      }
    } else {
      newParts.push(code);
    }
    code = oldParts.shift();
    if (code === void 0) {
      return newParts.join("");
    }
    isNumber = !isNumber;
  }
}
const isUnsetKeyword = (value) => value === "unset" || value === "undefined" || value === "none";
function iconToSVG(icon, customisations) {
  const fullIcon = {
    ...defaultIconProps,
    ...icon
  };
  const fullCustomisations = {
    ...defaultIconCustomisations,
    ...customisations
  };
  const box = {
    left: fullIcon.left,
    top: fullIcon.top,
    width: fullIcon.width,
    height: fullIcon.height
  };
  let body = fullIcon.body;
  [fullIcon, fullCustomisations].forEach((props) => {
    const transformations = [];
    const hFlip = props.hFlip;
    const vFlip = props.vFlip;
    let rotation = props.rotate;
    if (hFlip) {
      if (vFlip) {
        rotation += 2;
      } else {
        transformations.push("translate(" + (box.width + box.left).toString() + " " + (0 - box.top).toString() + ")");
        transformations.push("scale(-1 1)");
        box.top = box.left = 0;
      }
    } else if (vFlip) {
      transformations.push("translate(" + (0 - box.left).toString() + " " + (box.height + box.top).toString() + ")");
      transformations.push("scale(1 -1)");
      box.top = box.left = 0;
    }
    let tempValue;
    if (rotation < 0) {
      rotation -= Math.floor(rotation / 4) * 4;
    }
    rotation = rotation % 4;
    switch (rotation) {
      case 1:
        tempValue = box.height / 2 + box.top;
        transformations.unshift("rotate(90 " + tempValue.toString() + " " + tempValue.toString() + ")");
        break;
      case 2:
        transformations.unshift("rotate(180 " + (box.width / 2 + box.left).toString() + " " + (box.height / 2 + box.top).toString() + ")");
        break;
      case 3:
        tempValue = box.width / 2 + box.left;
        transformations.unshift("rotate(-90 " + tempValue.toString() + " " + tempValue.toString() + ")");
        break;
    }
    if (rotation % 2 === 1) {
      if (box.left !== box.top) {
        tempValue = box.left;
        box.left = box.top;
        box.top = tempValue;
      }
      if (box.width !== box.height) {
        tempValue = box.width;
        box.width = box.height;
        box.height = tempValue;
      }
    }
    if (transformations.length) {
      body = '<g transform="' + transformations.join(" ") + '">' + body + "</g>";
    }
  });
  const customisationsWidth = fullCustomisations.width;
  const customisationsHeight = fullCustomisations.height;
  const boxWidth = box.width;
  const boxHeight = box.height;
  let width;
  let height;
  if (customisationsWidth === null) {
    height = customisationsHeight === null ? "1em" : customisationsHeight === "auto" ? boxHeight : customisationsHeight;
    width = calculateSize(height, boxWidth / boxHeight);
  } else {
    width = customisationsWidth === "auto" ? boxWidth : customisationsWidth;
    height = customisationsHeight === null ? calculateSize(width, boxHeight / boxWidth) : customisationsHeight === "auto" ? boxHeight : customisationsHeight;
  }
  const attributes = {};
  const setAttr = (prop, value) => {
    if (!isUnsetKeyword(value)) {
      attributes[prop] = value.toString();
    }
  };
  setAttr("width", width);
  setAttr("height", height);
  attributes.viewBox = box.left.toString() + " " + box.top.toString() + " " + boxWidth.toString() + " " + boxHeight.toString();
  return {
    attributes,
    body
  };
}
const regex = /\sid="(\S+)"/g;
const randomPrefix = "IconifyId" + Date.now().toString(16) + (Math.random() * 16777216 | 0).toString(16);
let counter = 0;
function replaceIDs(body, prefix = randomPrefix) {
  const ids = [];
  let match;
  while (match = regex.exec(body)) {
    ids.push(match[1]);
  }
  if (!ids.length) {
    return body;
  }
  const suffix = "suffix" + (Math.random() * 16777216 | Date.now()).toString(16);
  ids.forEach((id) => {
    const newID = typeof prefix === "function" ? prefix(id) : prefix + (counter++).toString();
    const escapedID = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body.replace(new RegExp('([#;"])(' + escapedID + ')([")]|\\.[a-z])', "g"), "$1" + newID + suffix + "$3");
  });
  body = body.replace(new RegExp(suffix, "g"), "");
  return body;
}
const storage = /* @__PURE__ */ Object.create(null);
function setAPIModule(provider, item) {
  storage[provider] = item;
}
function getAPIModule(provider) {
  return storage[provider] || storage[""];
}
function createAPIConfig(source) {
  let resources;
  if (typeof source.resources === "string") {
    resources = [source.resources];
  } else {
    resources = source.resources;
    if (!(resources instanceof Array) || !resources.length) {
      return null;
    }
  }
  const result = {
    resources,
    path: source.path || "/",
    maxURL: source.maxURL || 500,
    rotate: source.rotate || 750,
    timeout: source.timeout || 5e3,
    random: source.random === true,
    index: source.index || 0,
    dataAfterTimeout: source.dataAfterTimeout !== false
  };
  return result;
}
const configStorage = /* @__PURE__ */ Object.create(null);
const fallBackAPISources = [
  "https://api.simplesvg.com",
  "https://api.unisvg.com"
];
const fallBackAPI = [];
while (fallBackAPISources.length > 0) {
  if (fallBackAPISources.length === 1) {
    fallBackAPI.push(fallBackAPISources.shift());
  } else {
    if (Math.random() > 0.5) {
      fallBackAPI.push(fallBackAPISources.shift());
    } else {
      fallBackAPI.push(fallBackAPISources.pop());
    }
  }
}
configStorage[""] = createAPIConfig({
  resources: ["https://api.iconify.design"].concat(fallBackAPI)
});
function addAPIProvider(provider, customConfig) {
  const config = createAPIConfig(customConfig);
  if (config === null) {
    return false;
  }
  configStorage[provider] = config;
  return true;
}
function getAPIConfig(provider) {
  return configStorage[provider];
}
const detectFetch = () => {
  let callback;
  try {
    callback = fetch;
    if (typeof callback === "function") {
      return callback;
    }
  } catch (err) {
  }
};
let fetchModule = detectFetch();
function calculateMaxLength(provider, prefix) {
  const config = getAPIConfig(provider);
  if (!config) {
    return 0;
  }
  let result;
  if (!config.maxURL) {
    result = 0;
  } else {
    let maxHostLength = 0;
    config.resources.forEach((item) => {
      const host = item;
      maxHostLength = Math.max(maxHostLength, host.length);
    });
    const url = prefix + ".json?icons=";
    result = config.maxURL - maxHostLength - config.path.length - url.length;
  }
  return result;
}
function shouldAbort(status) {
  return status === 404;
}
const prepare = (provider, prefix, icons) => {
  const results = [];
  const maxLength = calculateMaxLength(provider, prefix);
  const type = "icons";
  let item = {
    type,
    provider,
    prefix,
    icons: []
  };
  let length = 0;
  icons.forEach((name, index) => {
    length += name.length + 1;
    if (length >= maxLength && index > 0) {
      results.push(item);
      item = {
        type,
        provider,
        prefix,
        icons: []
      };
      length = name.length;
    }
    item.icons.push(name);
  });
  results.push(item);
  return results;
};
function getPath(provider) {
  if (typeof provider === "string") {
    const config = getAPIConfig(provider);
    if (config) {
      return config.path;
    }
  }
  return "/";
}
const send = (host, params, callback) => {
  if (!fetchModule) {
    callback("abort", 424);
    return;
  }
  let path = getPath(params.provider);
  switch (params.type) {
    case "icons": {
      const prefix = params.prefix;
      const icons = params.icons;
      const iconsList = icons.join(",");
      const urlParams = new URLSearchParams({
        icons: iconsList
      });
      path += prefix + ".json?" + urlParams.toString();
      break;
    }
    case "custom": {
      const uri = params.uri;
      path += uri.slice(0, 1) === "/" ? uri.slice(1) : uri;
      break;
    }
    default:
      callback("abort", 400);
      return;
  }
  let defaultError = 503;
  fetchModule(host + path).then((response) => {
    const status = response.status;
    if (status !== 200) {
      setTimeout(() => {
        callback(shouldAbort(status) ? "abort" : "next", status);
      });
      return;
    }
    defaultError = 501;
    return response.json();
  }).then((data) => {
    if (typeof data !== "object" || data === null) {
      setTimeout(() => {
        if (data === 404) {
          callback("abort", data);
        } else {
          callback("next", defaultError);
        }
      });
      return;
    }
    setTimeout(() => {
      callback("success", data);
    });
  }).catch(() => {
    callback("next", defaultError);
  });
};
const fetchAPIModule = {
  prepare,
  send
};
function sortIcons(icons) {
  const result = {
    loaded: [],
    missing: [],
    pending: []
  };
  const storage2 = /* @__PURE__ */ Object.create(null);
  icons.sort((a, b) => {
    if (a.provider !== b.provider) {
      return a.provider.localeCompare(b.provider);
    }
    if (a.prefix !== b.prefix) {
      return a.prefix.localeCompare(b.prefix);
    }
    return a.name.localeCompare(b.name);
  });
  let lastIcon = {
    provider: "",
    prefix: "",
    name: ""
  };
  icons.forEach((icon) => {
    if (lastIcon.name === icon.name && lastIcon.prefix === icon.prefix && lastIcon.provider === icon.provider) {
      return;
    }
    lastIcon = icon;
    const provider = icon.provider;
    const prefix = icon.prefix;
    const name = icon.name;
    const providerStorage = storage2[provider] || (storage2[provider] = /* @__PURE__ */ Object.create(null));
    const localStorage = providerStorage[prefix] || (providerStorage[prefix] = getStorage(provider, prefix));
    let list;
    if (name in localStorage.icons) {
      list = result.loaded;
    } else if (prefix === "" || localStorage.missing.has(name)) {
      list = result.missing;
    } else {
      list = result.pending;
    }
    const item = {
      provider,
      prefix,
      name
    };
    list.push(item);
  });
  return result;
}
function removeCallback(storages, id) {
  storages.forEach((storage2) => {
    const items = storage2.loaderCallbacks;
    if (items) {
      storage2.loaderCallbacks = items.filter((row) => row.id !== id);
    }
  });
}
function updateCallbacks(storage2) {
  if (!storage2.pendingCallbacksFlag) {
    storage2.pendingCallbacksFlag = true;
    setTimeout(() => {
      storage2.pendingCallbacksFlag = false;
      const items = storage2.loaderCallbacks ? storage2.loaderCallbacks.slice(0) : [];
      if (!items.length) {
        return;
      }
      let hasPending = false;
      const provider = storage2.provider;
      const prefix = storage2.prefix;
      items.forEach((item) => {
        const icons = item.icons;
        const oldLength = icons.pending.length;
        icons.pending = icons.pending.filter((icon) => {
          if (icon.prefix !== prefix) {
            return true;
          }
          const name = icon.name;
          if (storage2.icons[name]) {
            icons.loaded.push({
              provider,
              prefix,
              name
            });
          } else if (storage2.missing.has(name)) {
            icons.missing.push({
              provider,
              prefix,
              name
            });
          } else {
            hasPending = true;
            return true;
          }
          return false;
        });
        if (icons.pending.length !== oldLength) {
          if (!hasPending) {
            removeCallback([storage2], item.id);
          }
          item.callback(icons.loaded.slice(0), icons.missing.slice(0), icons.pending.slice(0), item.abort);
        }
      });
    });
  }
}
let idCounter = 0;
function storeCallback(callback, icons, pendingSources) {
  const id = idCounter++;
  const abort = removeCallback.bind(null, pendingSources, id);
  if (!icons.pending.length) {
    return abort;
  }
  const item = {
    id,
    icons,
    callback,
    abort
  };
  pendingSources.forEach((storage2) => {
    (storage2.loaderCallbacks || (storage2.loaderCallbacks = [])).push(item);
  });
  return abort;
}
function listToIcons(list, validate = true, simpleNames2 = false) {
  const result = [];
  list.forEach((item) => {
    const icon = typeof item === "string" ? stringToIcon(item, validate, simpleNames2) : item;
    if (icon) {
      result.push(icon);
    }
  });
  return result;
}
var defaultConfig = {
  resources: [],
  index: 0,
  timeout: 2e3,
  rotate: 750,
  random: false,
  dataAfterTimeout: false
};
function sendQuery(config, payload, query, done) {
  const resourcesCount = config.resources.length;
  const startIndex = config.random ? Math.floor(Math.random() * resourcesCount) : config.index;
  let resources;
  if (config.random) {
    let list = config.resources.slice(0);
    resources = [];
    while (list.length > 1) {
      const nextIndex = Math.floor(Math.random() * list.length);
      resources.push(list[nextIndex]);
      list = list.slice(0, nextIndex).concat(list.slice(nextIndex + 1));
    }
    resources = resources.concat(list);
  } else {
    resources = config.resources.slice(startIndex).concat(config.resources.slice(0, startIndex));
  }
  const startTime = Date.now();
  let status = "pending";
  let queriesSent = 0;
  let lastError;
  let timer = null;
  let queue = [];
  let doneCallbacks = [];
  if (typeof done === "function") {
    doneCallbacks.push(done);
  }
  function resetTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }
  function abort() {
    if (status === "pending") {
      status = "aborted";
    }
    resetTimer();
    queue.forEach((item) => {
      if (item.status === "pending") {
        item.status = "aborted";
      }
    });
    queue = [];
  }
  function subscribe(callback, overwrite) {
    if (overwrite) {
      doneCallbacks = [];
    }
    if (typeof callback === "function") {
      doneCallbacks.push(callback);
    }
  }
  function getQueryStatus() {
    return {
      startTime,
      payload,
      status,
      queriesSent,
      queriesPending: queue.length,
      subscribe,
      abort
    };
  }
  function failQuery() {
    status = "failed";
    doneCallbacks.forEach((callback) => {
      callback(void 0, lastError);
    });
  }
  function clearQueue() {
    queue.forEach((item) => {
      if (item.status === "pending") {
        item.status = "aborted";
      }
    });
    queue = [];
  }
  function moduleResponse(item, response, data) {
    const isError = response !== "success";
    queue = queue.filter((queued) => queued !== item);
    switch (status) {
      case "pending":
        break;
      case "failed":
        if (isError || !config.dataAfterTimeout) {
          return;
        }
        break;
      default:
        return;
    }
    if (response === "abort") {
      lastError = data;
      failQuery();
      return;
    }
    if (isError) {
      lastError = data;
      if (!queue.length) {
        if (!resources.length) {
          failQuery();
        } else {
          execNext();
        }
      }
      return;
    }
    resetTimer();
    clearQueue();
    if (!config.random) {
      const index = config.resources.indexOf(item.resource);
      if (index !== -1 && index !== config.index) {
        config.index = index;
      }
    }
    status = "completed";
    doneCallbacks.forEach((callback) => {
      callback(data);
    });
  }
  function execNext() {
    if (status !== "pending") {
      return;
    }
    resetTimer();
    const resource = resources.shift();
    if (resource === void 0) {
      if (queue.length) {
        timer = setTimeout(() => {
          resetTimer();
          if (status === "pending") {
            clearQueue();
            failQuery();
          }
        }, config.timeout);
        return;
      }
      failQuery();
      return;
    }
    const item = {
      status: "pending",
      resource,
      callback: (status2, data) => {
        moduleResponse(item, status2, data);
      }
    };
    queue.push(item);
    queriesSent++;
    timer = setTimeout(execNext, config.rotate);
    query(resource, payload, item.callback);
  }
  setTimeout(execNext);
  return getQueryStatus;
}
function initRedundancy(cfg) {
  const config = {
    ...defaultConfig,
    ...cfg
  };
  let queries = [];
  function cleanup() {
    queries = queries.filter((item) => item().status === "pending");
  }
  function query(payload, queryCallback, doneCallback) {
    const query2 = sendQuery(config, payload, queryCallback, (data, error) => {
      cleanup();
      if (doneCallback) {
        doneCallback(data, error);
      }
    });
    queries.push(query2);
    return query2;
  }
  function find(callback) {
    return queries.find((value) => {
      return callback(value);
    }) || null;
  }
  const instance = {
    query,
    find,
    setIndex: (index) => {
      config.index = index;
    },
    getIndex: () => config.index,
    cleanup
  };
  return instance;
}
function emptyCallback$1() {
}
const redundancyCache = /* @__PURE__ */ Object.create(null);
function getRedundancyCache(provider) {
  if (!redundancyCache[provider]) {
    const config = getAPIConfig(provider);
    if (!config) {
      return;
    }
    const redundancy = initRedundancy(config);
    const cachedReundancy = {
      config,
      redundancy
    };
    redundancyCache[provider] = cachedReundancy;
  }
  return redundancyCache[provider];
}
function sendAPIQuery(target, query, callback) {
  let redundancy;
  let send2;
  if (typeof target === "string") {
    const api = getAPIModule(target);
    if (!api) {
      callback(void 0, 424);
      return emptyCallback$1;
    }
    send2 = api.send;
    const cached = getRedundancyCache(target);
    if (cached) {
      redundancy = cached.redundancy;
    }
  } else {
    const config = createAPIConfig(target);
    if (config) {
      redundancy = initRedundancy(config);
      const moduleKey = target.resources ? target.resources[0] : "";
      const api = getAPIModule(moduleKey);
      if (api) {
        send2 = api.send;
      }
    }
  }
  if (!redundancy || !send2) {
    callback(void 0, 424);
    return emptyCallback$1;
  }
  return redundancy.query(query, send2, callback)().abort;
}
const browserCacheVersion = "iconify2";
const browserCachePrefix = "iconify";
const browserCacheCountKey = browserCachePrefix + "-count";
const browserCacheVersionKey = browserCachePrefix + "-version";
const browserStorageHour = 36e5;
const browserStorageCacheExpiration = 168;
function getStoredItem(func, key) {
  try {
    return func.getItem(key);
  } catch (err) {
  }
}
function setStoredItem(func, key, value) {
  try {
    func.setItem(key, value);
    return true;
  } catch (err) {
  }
}
function removeStoredItem(func, key) {
  try {
    func.removeItem(key);
  } catch (err) {
  }
}
function setBrowserStorageItemsCount(storage2, value) {
  return setStoredItem(storage2, browserCacheCountKey, value.toString());
}
function getBrowserStorageItemsCount(storage2) {
  return parseInt(getStoredItem(storage2, browserCacheCountKey)) || 0;
}
const browserStorageConfig = {
  local: true,
  session: true
};
const browserStorageEmptyItems = {
  local: /* @__PURE__ */ new Set(),
  session: /* @__PURE__ */ new Set()
};
let browserStorageStatus = false;
function setBrowserStorageStatus(status) {
  browserStorageStatus = status;
}
let _window = typeof window === "undefined" ? {} : window;
function getBrowserStorage(key) {
  const attr = key + "Storage";
  try {
    if (_window && _window[attr] && typeof _window[attr].length === "number") {
      return _window[attr];
    }
  } catch (err) {
  }
  browserStorageConfig[key] = false;
}
function iterateBrowserStorage(key, callback) {
  const func = getBrowserStorage(key);
  if (!func) {
    return;
  }
  const version = getStoredItem(func, browserCacheVersionKey);
  if (version !== browserCacheVersion) {
    if (version) {
      const total2 = getBrowserStorageItemsCount(func);
      for (let i = 0; i < total2; i++) {
        removeStoredItem(func, browserCachePrefix + i.toString());
      }
    }
    setStoredItem(func, browserCacheVersionKey, browserCacheVersion);
    setBrowserStorageItemsCount(func, 0);
    return;
  }
  const minTime = Math.floor(Date.now() / browserStorageHour) - browserStorageCacheExpiration;
  const parseItem = (index) => {
    const name = browserCachePrefix + index.toString();
    const item = getStoredItem(func, name);
    if (typeof item !== "string") {
      return;
    }
    try {
      const data = JSON.parse(item);
      if (typeof data === "object" && typeof data.cached === "number" && data.cached > minTime && typeof data.provider === "string" && typeof data.data === "object" && typeof data.data.prefix === "string" && callback(data, index)) {
        return true;
      }
    } catch (err) {
    }
    removeStoredItem(func, name);
  };
  let total = getBrowserStorageItemsCount(func);
  for (let i = total - 1; i >= 0; i--) {
    if (!parseItem(i)) {
      if (i === total - 1) {
        total--;
        setBrowserStorageItemsCount(func, total);
      } else {
        browserStorageEmptyItems[key].add(i);
      }
    }
  }
}
function initBrowserStorage() {
  if (browserStorageStatus) {
    return;
  }
  setBrowserStorageStatus(true);
  for (const key in browserStorageConfig) {
    iterateBrowserStorage(key, (item) => {
      const iconSet = item.data;
      const provider = item.provider;
      const prefix = iconSet.prefix;
      const storage2 = getStorage(provider, prefix);
      if (!addIconSet(storage2, iconSet).length) {
        return false;
      }
      const lastModified = iconSet.lastModified || -1;
      storage2.lastModifiedCached = storage2.lastModifiedCached ? Math.min(storage2.lastModifiedCached, lastModified) : lastModified;
      return true;
    });
  }
}
function updateLastModified(storage2, lastModified) {
  const lastValue = storage2.lastModifiedCached;
  if (lastValue && lastValue >= lastModified) {
    return lastValue === lastModified;
  }
  storage2.lastModifiedCached = lastModified;
  if (lastValue) {
    for (const key in browserStorageConfig) {
      iterateBrowserStorage(key, (item) => {
        const iconSet = item.data;
        return item.provider !== storage2.provider || iconSet.prefix !== storage2.prefix || iconSet.lastModified === lastModified;
      });
    }
  }
  return true;
}
function storeInBrowserStorage(storage2, data) {
  if (!browserStorageStatus) {
    initBrowserStorage();
  }
  function store(key) {
    let func;
    if (!browserStorageConfig[key] || !(func = getBrowserStorage(key))) {
      return;
    }
    const set = browserStorageEmptyItems[key];
    let index;
    if (set.size) {
      set.delete(index = Array.from(set).shift());
    } else {
      index = getBrowserStorageItemsCount(func);
      if (!setBrowserStorageItemsCount(func, index + 1)) {
        return;
      }
    }
    const item = {
      cached: Math.floor(Date.now() / browserStorageHour),
      provider: storage2.provider,
      data
    };
    return setStoredItem(func, browserCachePrefix + index.toString(), JSON.stringify(item));
  }
  if (data.lastModified && !updateLastModified(storage2, data.lastModified)) {
    return;
  }
  if (!Object.keys(data.icons).length) {
    return;
  }
  if (data.not_found) {
    data = Object.assign({}, data);
    delete data.not_found;
  }
  if (!store("local")) {
    store("session");
  }
}
function emptyCallback() {
}
function loadedNewIcons(storage2) {
  if (!storage2.iconsLoaderFlag) {
    storage2.iconsLoaderFlag = true;
    setTimeout(() => {
      storage2.iconsLoaderFlag = false;
      updateCallbacks(storage2);
    });
  }
}
function loadNewIcons(storage2, icons) {
  if (!storage2.iconsToLoad) {
    storage2.iconsToLoad = icons;
  } else {
    storage2.iconsToLoad = storage2.iconsToLoad.concat(icons).sort();
  }
  if (!storage2.iconsQueueFlag) {
    storage2.iconsQueueFlag = true;
    setTimeout(() => {
      storage2.iconsQueueFlag = false;
      const {provider, prefix} = storage2;
      const icons2 = storage2.iconsToLoad;
      delete storage2.iconsToLoad;
      let api;
      if (!icons2 || !(api = getAPIModule(provider))) {
        return;
      }
      const params = api.prepare(provider, prefix, icons2);
      params.forEach((item) => {
        sendAPIQuery(provider, item, (data) => {
          if (typeof data !== "object") {
            item.icons.forEach((name) => {
              storage2.missing.add(name);
            });
          } else {
            try {
              const parsed = addIconSet(storage2, data);
              if (!parsed.length) {
                return;
              }
              const pending = storage2.pendingIcons;
              if (pending) {
                parsed.forEach((name) => {
                  pending.delete(name);
                });
              }
              storeInBrowserStorage(storage2, data);
            } catch (err) {
              console.error(err);
            }
          }
          loadedNewIcons(storage2);
        });
      });
    });
  }
}
const loadIcons = (icons, callback) => {
  const cleanedIcons = listToIcons(icons, true, allowSimpleNames());
  const sortedIcons = sortIcons(cleanedIcons);
  if (!sortedIcons.pending.length) {
    let callCallback = true;
    if (callback) {
      setTimeout(() => {
        if (callCallback) {
          callback(sortedIcons.loaded, sortedIcons.missing, sortedIcons.pending, emptyCallback);
        }
      });
    }
    return () => {
      callCallback = false;
    };
  }
  const newIcons = /* @__PURE__ */ Object.create(null);
  const sources = [];
  let lastProvider, lastPrefix;
  sortedIcons.pending.forEach((icon) => {
    const {provider, prefix} = icon;
    if (prefix === lastPrefix && provider === lastProvider) {
      return;
    }
    lastProvider = provider;
    lastPrefix = prefix;
    sources.push(getStorage(provider, prefix));
    const providerNewIcons = newIcons[provider] || (newIcons[provider] = /* @__PURE__ */ Object.create(null));
    if (!providerNewIcons[prefix]) {
      providerNewIcons[prefix] = [];
    }
  });
  sortedIcons.pending.forEach((icon) => {
    const {provider, prefix, name} = icon;
    const storage2 = getStorage(provider, prefix);
    const pendingQueue = storage2.pendingIcons || (storage2.pendingIcons = /* @__PURE__ */ new Set());
    if (!pendingQueue.has(name)) {
      pendingQueue.add(name);
      newIcons[provider][prefix].push(name);
    }
  });
  sources.forEach((storage2) => {
    const {provider, prefix} = storage2;
    if (newIcons[provider][prefix].length) {
      loadNewIcons(storage2, newIcons[provider][prefix]);
    }
  });
  return callback ? storeCallback(callback, sortedIcons, sources) : emptyCallback;
};
function mergeCustomisations(defaults, item) {
  const result = {
    ...defaults
  };
  for (const key in item) {
    const value = item[key];
    const valueType = typeof value;
    if (key in defaultIconSizeCustomisations) {
      if (value === null || value && (valueType === "string" || valueType === "number")) {
        result[key] = value;
      }
    } else if (valueType === typeof result[key]) {
      result[key] = key === "rotate" ? value % 4 : value;
    }
  }
  return result;
}
const separator = /[\s,]+/;
function flipFromString(custom, flip) {
  flip.split(separator).forEach((str) => {
    const value = str.trim();
    switch (value) {
      case "horizontal":
        custom.hFlip = true;
        break;
      case "vertical":
        custom.vFlip = true;
        break;
    }
  });
}
function rotateFromString(value, defaultValue = 0) {
  const units = value.replace(/^-?[0-9.]*/, "");
  function cleanup(value2) {
    while (value2 < 0) {
      value2 += 4;
    }
    return value2 % 4;
  }
  if (units === "") {
    const num = parseInt(value);
    return isNaN(num) ? 0 : cleanup(num);
  } else if (units !== value) {
    let split = 0;
    switch (units) {
      case "%":
        split = 25;
        break;
      case "deg":
        split = 90;
    }
    if (split) {
      let num = parseFloat(value.slice(0, value.length - units.length));
      if (isNaN(num)) {
        return 0;
      }
      num = num / split;
      return num % 1 === 0 ? cleanup(num) : 0;
    }
  }
  return defaultValue;
}
function iconToHTML(body, attributes) {
  let renderAttribsHTML = body.indexOf("xlink:") === -1 ? "" : ' xmlns:xlink="http://www.w3.org/1999/xlink"';
  for (const attr in attributes) {
    renderAttribsHTML += " " + attr + '="' + attributes[attr] + '"';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg"' + renderAttribsHTML + ">" + body + "</svg>";
}
function encodeSVGforURL(svg) {
  return svg.replace(/"/g, "'").replace(/%/g, "%25").replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/\s+/g, " ");
}
function svgToData(svg) {
  return "data:image/svg+xml," + encodeSVGforURL(svg);
}
function svgToURL(svg) {
  return 'url("' + svgToData(svg) + '")';
}
const defaultExtendedIconCustomisations = {
  ...defaultIconCustomisations,
  inline: false
};
const svgDefaults = {
  xmlns: "http://www.w3.org/2000/svg",
  "xmlns:xlink": "http://www.w3.org/1999/xlink",
  "aria-hidden": true,
  role: "img"
};
const commonProps = {
  display: "inline-block"
};
const monotoneProps = {
  "background-color": "currentColor"
};
const coloredProps = {
  "background-color": "transparent"
};
const propsToAdd = {
  image: "var(--svg)",
  repeat: "no-repeat",
  size: "100% 100%"
};
const propsToAddTo = {
  "-webkit-mask": monotoneProps,
  mask: monotoneProps,
  background: coloredProps
};
for (const prefix in propsToAddTo) {
  const list = propsToAddTo[prefix];
  for (const prop in propsToAdd) {
    list[prefix + "-" + prop] = propsToAdd[prop];
  }
}
function fixSize(value) {
  return value + (value.match(/^[-0-9.]+$/) ? "px" : "");
}
function render(icon, props) {
  const customisations = mergeCustomisations(defaultExtendedIconCustomisations, props);
  const mode = props.mode || "svg";
  const componentProps = mode === "svg" ? {...svgDefaults} : {};
  if (icon.body.indexOf("xlink:") === -1) {
    delete componentProps["xmlns:xlink"];
  }
  let style = typeof props.style === "string" ? props.style : "";
  for (let key in props) {
    const value = props[key];
    if (value === void 0) {
      continue;
    }
    switch (key) {
      case "icon":
      case "style":
      case "onLoad":
      case "mode":
        break;
      case "inline":
      case "hFlip":
      case "vFlip":
        customisations[key] = value === true || value === "true" || value === 1;
        break;
      case "flip":
        if (typeof value === "string") {
          flipFromString(customisations, value);
        }
        break;
      case "color":
        style = style + (style.length > 0 && style.trim().slice(-1) !== ";" ? ";" : "") + "color: " + value + "; ";
        break;
      case "rotate":
        if (typeof value === "string") {
          customisations[key] = rotateFromString(value);
        } else if (typeof value === "number") {
          customisations[key] = value;
        }
        break;
      case "ariaHidden":
      case "aria-hidden":
        if (value !== true && value !== "true") {
          delete componentProps["aria-hidden"];
        }
        break;
      default:
        if (key.slice(0, 3) === "on:") {
          break;
        }
        if (defaultExtendedIconCustomisations[key] === void 0) {
          componentProps[key] = value;
        }
    }
  }
  const item = iconToSVG(icon, customisations);
  const renderAttribs = item.attributes;
  if (customisations.inline) {
    style = "vertical-align: -0.125em; " + style;
  }
  if (mode === "svg") {
    Object.assign(componentProps, renderAttribs);
    if (style !== "") {
      componentProps.style = style;
    }
    let localCounter = 0;
    let id = props.id;
    if (typeof id === "string") {
      id = id.replace(/-/g, "_");
    }
    return {
      svg: true,
      attributes: componentProps,
      body: replaceIDs(item.body, id ? () => id + "ID" + localCounter++ : "iconifySvelte")
    };
  }
  const {body, width, height} = icon;
  const useMask = mode === "mask" || (mode === "bg" ? false : body.indexOf("currentColor") !== -1);
  const html = iconToHTML(body, {
    ...renderAttribs,
    width: width + "",
    height: height + ""
  });
  const url = svgToURL(html);
  const styles = {
    "--svg": url
  };
  const size = (prop) => {
    const value = renderAttribs[prop];
    if (value) {
      styles[prop] = fixSize(value);
    }
  };
  size("width");
  size("height");
  Object.assign(styles, commonProps, useMask ? monotoneProps : coloredProps);
  let customStyle = "";
  for (const key in styles) {
    customStyle += key + ": " + styles[key] + ";";
  }
  componentProps.style = customStyle + style;
  return {
    svg: false,
    attributes: componentProps
  };
}
allowSimpleNames(true);
setAPIModule("", fetchAPIModule);
if (typeof document !== "undefined" && typeof window !== "undefined") {
  initBrowserStorage();
  const _window2 = window;
  if (_window2.IconifyPreload !== void 0) {
    const preload = _window2.IconifyPreload;
    const err = "Invalid IconifyPreload syntax.";
    if (typeof preload === "object" && preload !== null) {
      (preload instanceof Array ? preload : [preload]).forEach((item) => {
        try {
          if (typeof item !== "object" || item === null || item instanceof Array || typeof item.icons !== "object" || typeof item.prefix !== "string" || !addCollection(item)) {
            console.error(err);
          }
        } catch (e) {
          console.error(err);
        }
      });
    }
  }
  if (_window2.IconifyProviders !== void 0) {
    const providers = _window2.IconifyProviders;
    if (typeof providers === "object" && providers !== null) {
      for (let key in providers) {
        const err = "IconifyProviders[" + key + "] is invalid.";
        try {
          const value = providers[key];
          if (typeof value !== "object" || !value || value.resources === void 0) {
            continue;
          }
          if (!addAPIProvider(key, value)) {
            console.error(err);
          }
        } catch (e) {
          console.error(err);
        }
      }
    }
  }
}
function checkIconState(icon, state, mounted, callback, onload) {
  function abortLoading() {
    if (state.loading) {
      state.loading.abort();
      state.loading = null;
    }
  }
  if (typeof icon === "object" && icon !== null && typeof icon.body === "string") {
    state.name = "";
    abortLoading();
    return {data: {...defaultIconProps, ...icon}};
  }
  let iconName;
  if (typeof icon !== "string" || (iconName = stringToIcon(icon, false, true)) === null) {
    abortLoading();
    return null;
  }
  const data = getIconData(iconName);
  if (!data) {
    if (mounted && (!state.loading || state.loading.name !== icon)) {
      abortLoading();
      state.name = "";
      state.loading = {
        name: icon,
        abort: loadIcons([iconName], callback)
      };
    }
    return null;
  }
  abortLoading();
  if (state.name !== icon) {
    state.name = icon;
    if (onload && !state.destroyed) {
      onload(icon);
    }
  }
  const classes = ["iconify"];
  if (iconName.prefix !== "") {
    classes.push("iconify--" + iconName.prefix);
  }
  if (iconName.provider !== "") {
    classes.push("iconify--" + iconName.provider);
  }
  return {data, classes};
}
function generateIcon(icon, props) {
  return icon ? render({
    ...defaultIconProps,
    ...icon
  }, props) : null;
}
var checkIconState_1 = checkIconState;
var generateIcon_1 = generateIcon;

/* generated by Svelte v3.58.0 */

function create_if_block(ctx) {
	let if_block_anchor;

	function select_block_type(ctx, dirty) {
		if (/*data*/ ctx[0].svg) return create_if_block_1;
		return create_else_block;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		l(nodes) {
			if_block.l(nodes);
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_block.m(target, anchor);
			insert_hydration(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		d(detaching) {
			if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

// (113:1) {:else}
function create_else_block(ctx) {
	let span;
	let span_levels = [/*data*/ ctx[0].attributes];
	let span_data = {};

	for (let i = 0; i < span_levels.length; i += 1) {
		span_data = assign(span_data, span_levels[i]);
	}

	return {
		c() {
			span = element("span");
			this.h();
		},
		l(nodes) {
			span = claim_element(nodes, "SPAN", {});
			children(span).forEach(detach);
			this.h();
		},
		h() {
			set_attributes(span, span_data);
		},
		m(target, anchor) {
			insert_hydration(target, span, anchor);
		},
		p(ctx, dirty) {
			set_attributes(span, span_data = get_spread_update(span_levels, [dirty & /*data*/ 1 && /*data*/ ctx[0].attributes]));
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (109:1) {#if data.svg}
function create_if_block_1(ctx) {
	let svg;
	let raw_value = /*data*/ ctx[0].body + "";
	let svg_levels = [/*data*/ ctx[0].attributes];
	let svg_data = {};

	for (let i = 0; i < svg_levels.length; i += 1) {
		svg_data = assign(svg_data, svg_levels[i]);
	}

	return {
		c() {
			svg = svg_element("svg");
			this.h();
		},
		l(nodes) {
			svg = claim_svg_element(nodes, "svg", {});
			var svg_nodes = children(svg);
			svg_nodes.forEach(detach);
			this.h();
		},
		h() {
			set_svg_attributes(svg, svg_data);
		},
		m(target, anchor) {
			insert_hydration(target, svg, anchor);
			svg.innerHTML = raw_value;
		},
		p(ctx, dirty) {
			if (dirty & /*data*/ 1 && raw_value !== (raw_value = /*data*/ ctx[0].body + "")) svg.innerHTML = raw_value;			set_svg_attributes(svg, svg_data = get_spread_update(svg_levels, [dirty & /*data*/ 1 && /*data*/ ctx[0].attributes]));
		},
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

function create_fragment$1(ctx) {
	let if_block_anchor;
	let if_block = /*data*/ ctx[0] && create_if_block(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		l(nodes) {
			if (if_block) if_block.l(nodes);
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert_hydration(target, if_block_anchor, anchor);
		},
		p(ctx, [dirty]) {
			if (/*data*/ ctx[0]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block(ctx);
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	const state = {
		// Last icon name
		name: '',
		// Loading status
		loading: null,
		// Destroyed status
		destroyed: false
	};

	// Mounted status
	let mounted = false;

	// Callback counter
	let counter = 0;

	// Generated data
	let data;

	const onLoad = icon => {
		// Legacy onLoad property
		if (typeof $$props.onLoad === 'function') {
			$$props.onLoad(icon);
		}

		// on:load event
		const dispatch = createEventDispatcher();

		dispatch('load', { icon });
	};

	// Increase counter when loaded to force re-calculation of data
	function loaded() {
		$$invalidate(3, counter++, counter);
	}

	// Force re-render
	onMount(() => {
		$$invalidate(2, mounted = true);
	});

	// Abort loading when component is destroyed
	onDestroy(() => {
		$$invalidate(1, state.destroyed = true, state);

		if (state.loading) {
			state.loading.abort();
			$$invalidate(1, state.loading = null, state);
		}
	});

	$$self.$$set = $$new_props => {
		$$invalidate(6, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
	};

	$$self.$$.update = () => {
		 {
			const iconData = checkIconState_1($$props.icon, state, mounted, loaded, onLoad);
			$$invalidate(0, data = iconData ? generateIcon_1(iconData.data, $$props) : null);

			if (data && iconData.classes) {
				// Add classes
				$$invalidate(
					0,
					data.attributes['class'] = (typeof $$props['class'] === 'string'
					? $$props['class'] + ' '
					: '') + iconData.classes.join(' '),
					data
				);
			}
		}
	};

	$$props = exclude_internal_props($$props);
	return [data, state, mounted, counter];
}

class Component$1 extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
	}
}

/* generated by Svelte v3.58.0 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[7] = list[i].link;
	child_ctx[8] = list[i].icon;
	return child_ctx;
}

// (118:8) {#each social_links as { link, icon }}
function create_each_block(ctx) {
	let li;
	let a;
	let icon;
	let t0;
	let span;
	let t1_value = /*link*/ ctx[7].label + "";
	let t1;
	let a_href_value;
	let t2;
	let current;
	icon = new Component$1({ props: { icon: /*icon*/ ctx[8] } });

	return {
		c() {
			li = element("li");
			a = element("a");
			create_component(icon.$$.fragment);
			t0 = space();
			span = element("span");
			t1 = text(t1_value);
			t2 = space();
			this.h();
		},
		l(nodes) {
			li = claim_element(nodes, "LI", { class: true });
			var li_nodes = children(li);
			a = claim_element(li_nodes, "A", { href: true, class: true });
			var a_nodes = children(a);
			claim_component(icon.$$.fragment, a_nodes);
			t0 = claim_space(a_nodes);
			span = claim_element(a_nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t1 = claim_text(span_nodes, t1_value);
			span_nodes.forEach(detach);
			a_nodes.forEach(detach);
			t2 = claim_space(li_nodes);
			li_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(span, "class", "svelte-1byd7us");
			attr(a, "href", a_href_value = /*link*/ ctx[7].url);
			attr(a, "class", "svelte-1byd7us");
			attr(li, "class", "svelte-1byd7us");
		},
		m(target, anchor) {
			insert_hydration(target, li, anchor);
			append_hydration(li, a);
			mount_component(icon, a, null);
			append_hydration(a, t0);
			append_hydration(a, span);
			append_hydration(span, t1);
			append_hydration(li, t2);
			current = true;
		},
		p(ctx, dirty) {
			const icon_changes = {};
			if (dirty & /*social_links*/ 8) icon_changes.icon = /*icon*/ ctx[8];
			icon.$set(icon_changes);
			if ((!current || dirty & /*social_links*/ 8) && t1_value !== (t1_value = /*link*/ ctx[7].label + "")) set_data(t1, t1_value);

			if (!current || dirty & /*social_links*/ 8 && a_href_value !== (a_href_value = /*link*/ ctx[7].url)) {
				attr(a, "href", a_href_value);
			}
		},
		i(local) {
			if (current) return;
			transition_in(icon.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(icon.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(li);
			destroy_component(icon);
		}
	};
}

function create_fragment$2(ctx) {
	let div3;
	let header;
	let div2;
	let figure;
	let img;
	let img_src_value;
	let img_alt_value;
	let t0;
	let div1;
	let h1;
	let t1;
	let t2;
	let div0;
	let raw_value = /*description*/ ctx[0].html + "";
	let t3;
	let ul;
	let current;
	let each_value = /*social_links*/ ctx[3];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			div3 = element("div");
			header = element("header");
			div2 = element("div");
			figure = element("figure");
			img = element("img");
			t0 = space();
			div1 = element("div");
			h1 = element("h1");
			t1 = text(/*name*/ ctx[2]);
			t2 = space();
			div0 = element("div");
			t3 = space();
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			div3 = claim_element(nodes, "DIV", { class: true, id: true });
			var div3_nodes = children(div3);
			header = claim_element(div3_nodes, "HEADER", {});
			var header_nodes = children(header);
			div2 = claim_element(header_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			figure = claim_element(div2_nodes, "FIGURE", { class: true });
			var figure_nodes = children(figure);
			img = claim_element(figure_nodes, "IMG", { src: true, alt: true, class: true });
			figure_nodes.forEach(detach);
			t0 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			h1 = claim_element(div1_nodes, "H1", { class: true });
			var h1_nodes = children(h1);
			t1 = claim_text(h1_nodes, /*name*/ ctx[2]);
			h1_nodes.forEach(detach);
			t2 = claim_space(div1_nodes);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			div0_nodes.forEach(detach);
			t3 = claim_space(div1_nodes);
			ul = claim_element(div1_nodes, "UL", { class: true });
			var ul_nodes = children(ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(ul_nodes);
			}

			ul_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			header_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			this.h();
		},
		h() {
			if (!src_url_equal(img.src, img_src_value = /*portrait*/ ctx[1].image.url)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = /*portrait*/ ctx[1].image.alt);
			attr(img, "class", "svelte-1byd7us");
			attr(figure, "class", "svelte-1byd7us");
			toggle_class(figure, "square", /*portrait*/ ctx[1].variation === "square");
			attr(h1, "class", "headline svelte-1byd7us");
			attr(div0, "class", "description svelte-1byd7us");
			attr(ul, "class", "social svelte-1byd7us");
			attr(div1, "class", "svelte-1byd7us");
			attr(div2, "class", "section-container svelte-1byd7us");
			attr(div3, "class", "section");
			attr(div3, "id", "section-c01c4214");
		},
		m(target, anchor) {
			insert_hydration(target, div3, anchor);
			append_hydration(div3, header);
			append_hydration(header, div2);
			append_hydration(div2, figure);
			append_hydration(figure, img);
			append_hydration(div2, t0);
			append_hydration(div2, div1);
			append_hydration(div1, h1);
			append_hydration(h1, t1);
			append_hydration(div1, t2);
			append_hydration(div1, div0);
			div0.innerHTML = raw_value;
			append_hydration(div1, t3);
			append_hydration(div1, ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(ul, null);
				}
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (!current || dirty & /*portrait*/ 2 && !src_url_equal(img.src, img_src_value = /*portrait*/ ctx[1].image.url)) {
				attr(img, "src", img_src_value);
			}

			if (!current || dirty & /*portrait*/ 2 && img_alt_value !== (img_alt_value = /*portrait*/ ctx[1].image.alt)) {
				attr(img, "alt", img_alt_value);
			}

			if (!current || dirty & /*portrait*/ 2) {
				toggle_class(figure, "square", /*portrait*/ ctx[1].variation === "square");
			}

			if (!current || dirty & /*name*/ 4) set_data(t1, /*name*/ ctx[2]);
			if ((!current || dirty & /*description*/ 1) && raw_value !== (raw_value = /*description*/ ctx[0].html + "")) div0.innerHTML = raw_value;
			if (dirty & /*social_links*/ 8) {
				each_value = /*social_links*/ ctx[3];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(ul, null);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(div3);
			destroy_each(each_blocks, detaching);
		}
	};
}

function instance$2($$self, $$props, $$invalidate) {
	let { favicon } = $$props;
	let { site_nav } = $$props;
	let { title } = $$props;
	let { description } = $$props;
	let { portrait } = $$props;
	let { name } = $$props;
	let { social_links } = $$props;

	$$self.$$set = $$props => {
		if ('favicon' in $$props) $$invalidate(4, favicon = $$props.favicon);
		if ('site_nav' in $$props) $$invalidate(5, site_nav = $$props.site_nav);
		if ('title' in $$props) $$invalidate(6, title = $$props.title);
		if ('description' in $$props) $$invalidate(0, description = $$props.description);
		if ('portrait' in $$props) $$invalidate(1, portrait = $$props.portrait);
		if ('name' in $$props) $$invalidate(2, name = $$props.name);
		if ('social_links' in $$props) $$invalidate(3, social_links = $$props.social_links);
	};

	return [description, portrait, name, social_links, favicon, site_nav, title];
}

class Component$2 extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
			favicon: 4,
			site_nav: 5,
			title: 6,
			description: 0,
			portrait: 1,
			name: 2,
			social_links: 3
		});
	}
}

/* generated by Svelte v3.58.0 */

function create_fragment$3(ctx) {
	let div2;
	let div1;
	let div0;
	let raw_value = /*content*/ ctx[0].html + "";

	return {
		c() {
			div2 = element("div");
			div1 = element("div");
			div0 = element("div");
			this.h();
		},
		l(nodes) {
			div2 = claim_element(nodes, "DIV", { class: true, id: true });
			var div2_nodes = children(div2);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			div0_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div0, "class", "section-container content");
			attr(div1, "class", "section");
			attr(div2, "class", "section");
			attr(div2, "id", "section-f6fccdc0");
		},
		m(target, anchor) {
			insert_hydration(target, div2, anchor);
			append_hydration(div2, div1);
			append_hydration(div1, div0);
			div0.innerHTML = raw_value;
		},
		p(ctx, [dirty]) {
			if (dirty & /*content*/ 1 && raw_value !== (raw_value = /*content*/ ctx[0].html + "")) div0.innerHTML = raw_value;		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div2);
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	let { favicon } = $$props;
	let { site_nav } = $$props;
	let { title } = $$props;
	let { description } = $$props;
	let { content } = $$props;

	$$self.$$set = $$props => {
		if ('favicon' in $$props) $$invalidate(1, favicon = $$props.favicon);
		if ('site_nav' in $$props) $$invalidate(2, site_nav = $$props.site_nav);
		if ('title' in $$props) $$invalidate(3, title = $$props.title);
		if ('description' in $$props) $$invalidate(4, description = $$props.description);
		if ('content' in $$props) $$invalidate(0, content = $$props.content);
	};

	return [content, favicon, site_nav, title, description];
}

class Component$3 extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
			favicon: 1,
			site_nav: 2,
			title: 3,
			description: 4,
			content: 0
		});
	}
}

/* generated by Svelte v3.58.0 */

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[6] = list[i];
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[9] = list[i].link;
	return child_ctx;
}

// (77:12) {#each item.links as {link}}
function create_each_block_1(ctx) {
	let a;
	let t_value = /*link*/ ctx[9].label + "";
	let t;
	let a_href_value;

	return {
		c() {
			a = element("a");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			a = claim_element(nodes, "A", { class: true, href: true });
			var a_nodes = children(a);
			t = claim_text(a_nodes, t_value);
			a_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(a, "class", "link");
			attr(a, "href", a_href_value = /*link*/ ctx[9].url);
		},
		m(target, anchor) {
			insert_hydration(target, a, anchor);
			append_hydration(a, t);
		},
		p(ctx, dirty) {
			if (dirty & /*items*/ 2 && t_value !== (t_value = /*link*/ ctx[9].label + "")) set_data(t, t_value);

			if (dirty & /*items*/ 2 && a_href_value !== (a_href_value = /*link*/ ctx[9].url)) {
				attr(a, "href", a_href_value);
			}
		},
		d(detaching) {
			if (detaching) detach(a);
		}
	};
}

// (82:8) {#if item.thumbnail.url}
function create_if_block$1(ctx) {
	let img;
	let img_src_value;
	let img_alt_value;

	return {
		c() {
			img = element("img");
			this.h();
		},
		l(nodes) {
			img = claim_element(nodes, "IMG", { src: true, alt: true, class: true });
			this.h();
		},
		h() {
			if (!src_url_equal(img.src, img_src_value = /*item*/ ctx[6].thumbnail.url)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = /*item*/ ctx[6].thumbnail.alt);
			attr(img, "class", "svelte-hf1yy6");
		},
		m(target, anchor) {
			insert_hydration(target, img, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*items*/ 2 && !src_url_equal(img.src, img_src_value = /*item*/ ctx[6].thumbnail.url)) {
				attr(img, "src", img_src_value);
			}

			if (dirty & /*items*/ 2 && img_alt_value !== (img_alt_value = /*item*/ ctx[6].thumbnail.alt)) {
				attr(img, "alt", img_alt_value);
			}
		},
		d(detaching) {
			if (detaching) detach(img);
		}
	};
}

// (70:6) {#each items as item}
function create_each_block$1(ctx) {
	let li;
	let div2;
	let span;
	let t0_value = /*item*/ ctx[6].date + "";
	let t0;
	let t1;
	let h3;
	let t2_value = /*item*/ ctx[6].title + "";
	let t2;
	let t3;
	let div0;
	let raw_value = /*item*/ ctx[6].description.html + "";
	let t4;
	let div1;
	let t5;
	let t6;
	let each_value_1 = /*item*/ ctx[6].links;
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	let if_block = /*item*/ ctx[6].thumbnail.url && create_if_block$1(ctx);

	return {
		c() {
			li = element("li");
			div2 = element("div");
			span = element("span");
			t0 = text(t0_value);
			t1 = space();
			h3 = element("h3");
			t2 = text(t2_value);
			t3 = space();
			div0 = element("div");
			t4 = space();
			div1 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t5 = space();
			if (if_block) if_block.c();
			t6 = space();
			this.h();
		},
		l(nodes) {
			li = claim_element(nodes, "LI", { class: true });
			var li_nodes = children(li);
			div2 = claim_element(li_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			span = claim_element(div2_nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t0 = claim_text(span_nodes, t0_value);
			span_nodes.forEach(detach);
			t1 = claim_space(div2_nodes);
			h3 = claim_element(div2_nodes, "H3", { class: true });
			var h3_nodes = children(h3);
			t2 = claim_text(h3_nodes, t2_value);
			h3_nodes.forEach(detach);
			t3 = claim_space(div2_nodes);
			div0 = claim_element(div2_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			div0_nodes.forEach(detach);
			t4 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div1_nodes);
			}

			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			t5 = claim_space(li_nodes);
			if (if_block) if_block.l(li_nodes);
			t6 = claim_space(li_nodes);
			li_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(span, "class", "date svelte-hf1yy6");
			attr(h3, "class", "title svelte-hf1yy6");
			attr(div0, "class", "description svelte-hf1yy6");
			attr(div1, "class", "links svelte-hf1yy6");
			attr(div2, "class", "post-info");
			attr(li, "class", "svelte-hf1yy6");
		},
		m(target, anchor) {
			insert_hydration(target, li, anchor);
			append_hydration(li, div2);
			append_hydration(div2, span);
			append_hydration(span, t0);
			append_hydration(div2, t1);
			append_hydration(div2, h3);
			append_hydration(h3, t2);
			append_hydration(div2, t3);
			append_hydration(div2, div0);
			div0.innerHTML = raw_value;
			append_hydration(div2, t4);
			append_hydration(div2, div1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div1, null);
				}
			}

			append_hydration(li, t5);
			if (if_block) if_block.m(li, null);
			append_hydration(li, t6);
		},
		p(ctx, dirty) {
			if (dirty & /*items*/ 2 && t0_value !== (t0_value = /*item*/ ctx[6].date + "")) set_data(t0, t0_value);
			if (dirty & /*items*/ 2 && t2_value !== (t2_value = /*item*/ ctx[6].title + "")) set_data(t2, t2_value);
			if (dirty & /*items*/ 2 && raw_value !== (raw_value = /*item*/ ctx[6].description.html + "")) div0.innerHTML = raw_value;
			if (dirty & /*items*/ 2) {
				each_value_1 = /*item*/ ctx[6].links;
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div1, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}

			if (/*item*/ ctx[6].thumbnail.url) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block$1(ctx);
					if_block.c();
					if_block.m(li, t6);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		d(detaching) {
			if (detaching) detach(li);
			destroy_each(each_blocks, detaching);
			if (if_block) if_block.d();
		}
	};
}

function create_fragment$4(ctx) {
	let div1;
	let section;
	let div0;
	let h2;
	let t0;
	let t1;
	let ul;
	let each_value = /*items*/ ctx[1];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	return {
		c() {
			div1 = element("div");
			section = element("section");
			div0 = element("div");
			h2 = element("h2");
			t0 = text(/*heading*/ ctx[0]);
			t1 = space();
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			div1 = claim_element(nodes, "DIV", { class: true, id: true });
			var div1_nodes = children(div1);
			section = claim_element(div1_nodes, "SECTION", {});
			var section_nodes = children(section);
			div0 = claim_element(section_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			h2 = claim_element(div0_nodes, "H2", { class: true });
			var h2_nodes = children(h2);
			t0 = claim_text(h2_nodes, /*heading*/ ctx[0]);
			h2_nodes.forEach(detach);
			t1 = claim_space(div0_nodes);
			ul = claim_element(div0_nodes, "UL", { class: true });
			var ul_nodes = children(ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(ul_nodes);
			}

			ul_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			section_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h2, "class", "heading svelte-hf1yy6");
			attr(ul, "class", "items svelte-hf1yy6");
			attr(div0, "class", "section-container");
			attr(div1, "class", "section");
			attr(div1, "id", "section-21248363");
		},
		m(target, anchor) {
			insert_hydration(target, div1, anchor);
			append_hydration(div1, section);
			append_hydration(section, div0);
			append_hydration(div0, h2);
			append_hydration(h2, t0);
			append_hydration(div0, t1);
			append_hydration(div0, ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(ul, null);
				}
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*heading*/ 1) set_data(t0, /*heading*/ ctx[0]);

			if (dirty & /*items*/ 2) {
				each_value = /*items*/ ctx[1];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(ul, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div1);
			destroy_each(each_blocks, detaching);
		}
	};
}

function instance$4($$self, $$props, $$invalidate) {
	let { favicon } = $$props;
	let { site_nav } = $$props;
	let { title } = $$props;
	let { description } = $$props;
	let { heading } = $$props;
	let { items } = $$props;

	$$self.$$set = $$props => {
		if ('favicon' in $$props) $$invalidate(2, favicon = $$props.favicon);
		if ('site_nav' in $$props) $$invalidate(3, site_nav = $$props.site_nav);
		if ('title' in $$props) $$invalidate(4, title = $$props.title);
		if ('description' in $$props) $$invalidate(5, description = $$props.description);
		if ('heading' in $$props) $$invalidate(0, heading = $$props.heading);
		if ('items' in $$props) $$invalidate(1, items = $$props.items);
	};

	return [heading, items, favicon, site_nav, title, description];
}

class Component$4 extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
			favicon: 2,
			site_nav: 3,
			title: 4,
			description: 5,
			heading: 0,
			items: 1
		});
	}
}

/* generated by Svelte v3.58.0 */

function get_each_context$2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[6] = list[i].label;
	child_ctx[7] = list[i].icon;
	return child_ctx;
}

// (44:4) {#each items as {label,icon}}
function create_each_block$2(ctx) {
	let li;
	let icon;
	let t0;
	let span;
	let t1_value = /*label*/ ctx[6] + "";
	let t1;
	let t2;
	let current;
	icon = new Component$1({ props: { icon: /*icon*/ ctx[7] } });

	return {
		c() {
			li = element("li");
			create_component(icon.$$.fragment);
			t0 = space();
			span = element("span");
			t1 = text(t1_value);
			t2 = space();
			this.h();
		},
		l(nodes) {
			li = claim_element(nodes, "LI", { class: true });
			var li_nodes = children(li);
			claim_component(icon.$$.fragment, li_nodes);
			t0 = claim_space(li_nodes);
			span = claim_element(li_nodes, "SPAN", {});
			var span_nodes = children(span);
			t1 = claim_text(span_nodes, t1_value);
			span_nodes.forEach(detach);
			t2 = claim_space(li_nodes);
			li_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(li, "class", "svelte-1n9fm19");
		},
		m(target, anchor) {
			insert_hydration(target, li, anchor);
			mount_component(icon, li, null);
			append_hydration(li, t0);
			append_hydration(li, span);
			append_hydration(span, t1);
			append_hydration(li, t2);
			current = true;
		},
		p(ctx, dirty) {
			const icon_changes = {};
			if (dirty & /*items*/ 4) icon_changes.icon = /*icon*/ ctx[7];
			icon.$set(icon_changes);
			if ((!current || dirty & /*items*/ 4) && t1_value !== (t1_value = /*label*/ ctx[6] + "")) set_data(t1, t1_value);
		},
		i(local) {
			if (current) return;
			transition_in(icon.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(icon.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(li);
			destroy_component(icon);
		}
	};
}

function create_fragment$5(ctx) {
	let div1;
	let section;
	let h2;
	let t0;
	let t1;
	let div0;
	let raw_value = /*description*/ ctx[0].html + "";
	let t2;
	let ul;
	let current;
	let each_value = /*items*/ ctx[2];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			div1 = element("div");
			section = element("section");
			h2 = element("h2");
			t0 = text(/*heading*/ ctx[1]);
			t1 = space();
			div0 = element("div");
			t2 = space();
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			div1 = claim_element(nodes, "DIV", { class: true, id: true });
			var div1_nodes = children(div1);
			section = claim_element(div1_nodes, "SECTION", { class: true });
			var section_nodes = children(section);
			h2 = claim_element(section_nodes, "H2", { class: true });
			var h2_nodes = children(h2);
			t0 = claim_text(h2_nodes, /*heading*/ ctx[1]);
			h2_nodes.forEach(detach);
			t1 = claim_space(section_nodes);
			div0 = claim_element(section_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			div0_nodes.forEach(detach);
			t2 = claim_space(section_nodes);
			ul = claim_element(section_nodes, "UL", { class: true });
			var ul_nodes = children(ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(ul_nodes);
			}

			ul_nodes.forEach(detach);
			section_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h2, "class", "heading");
			attr(div0, "class", "description svelte-1n9fm19");
			attr(ul, "class", "svelte-1n9fm19");
			attr(section, "class", "section-container");
			attr(div1, "class", "section");
			attr(div1, "id", "section-72adce69");
		},
		m(target, anchor) {
			insert_hydration(target, div1, anchor);
			append_hydration(div1, section);
			append_hydration(section, h2);
			append_hydration(h2, t0);
			append_hydration(section, t1);
			append_hydration(section, div0);
			div0.innerHTML = raw_value;
			append_hydration(section, t2);
			append_hydration(section, ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(ul, null);
				}
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (!current || dirty & /*heading*/ 2) set_data(t0, /*heading*/ ctx[1]);
			if ((!current || dirty & /*description*/ 1) && raw_value !== (raw_value = /*description*/ ctx[0].html + "")) div0.innerHTML = raw_value;
			if (dirty & /*items*/ 4) {
				each_value = /*items*/ ctx[2];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$2(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$2(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(ul, null);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(div1);
			destroy_each(each_blocks, detaching);
		}
	};
}

function instance$5($$self, $$props, $$invalidate) {
	let { favicon } = $$props;
	let { site_nav } = $$props;
	let { title } = $$props;
	let { description } = $$props;
	let { heading } = $$props;
	let { items } = $$props;

	$$self.$$set = $$props => {
		if ('favicon' in $$props) $$invalidate(3, favicon = $$props.favicon);
		if ('site_nav' in $$props) $$invalidate(4, site_nav = $$props.site_nav);
		if ('title' in $$props) $$invalidate(5, title = $$props.title);
		if ('description' in $$props) $$invalidate(0, description = $$props.description);
		if ('heading' in $$props) $$invalidate(1, heading = $$props.heading);
		if ('items' in $$props) $$invalidate(2, items = $$props.items);
	};

	return [description, heading, items, favicon, site_nav, title];
}

class Component$5 extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
			favicon: 3,
			site_nav: 4,
			title: 5,
			description: 0,
			heading: 1,
			items: 2
		});
	}
}

/* generated by Svelte v3.58.0 */

function get_each_context$3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[7] = list[i].link;
	child_ctx[8] = list[i].icon;
	return child_ctx;
}

// (102:8) {#each social_links as {link, icon}}
function create_each_block$3(ctx) {
	let li;
	let a;
	let icon;
	let a_href_value;
	let a_aria_label_value;
	let t;
	let current;
	icon = new Component$1({ props: { icon: /*icon*/ ctx[8] } });

	return {
		c() {
			li = element("li");
			a = element("a");
			create_component(icon.$$.fragment);
			t = space();
			this.h();
		},
		l(nodes) {
			li = claim_element(nodes, "LI", {});
			var li_nodes = children(li);

			a = claim_element(li_nodes, "A", {
				href: true,
				"aria-label": true,
				class: true
			});

			var a_nodes = children(a);
			claim_component(icon.$$.fragment, a_nodes);
			a_nodes.forEach(detach);
			t = claim_space(li_nodes);
			li_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(a, "href", a_href_value = /*link*/ ctx[7].url);
			attr(a, "aria-label", a_aria_label_value = /*icon*/ ctx[8]);
			attr(a, "class", "svelte-i8f0ga");
		},
		m(target, anchor) {
			insert_hydration(target, li, anchor);
			append_hydration(li, a);
			mount_component(icon, a, null);
			append_hydration(li, t);
			current = true;
		},
		p(ctx, dirty) {
			const icon_changes = {};
			if (dirty & /*social_links*/ 4) icon_changes.icon = /*icon*/ ctx[8];
			icon.$set(icon_changes);

			if (!current || dirty & /*social_links*/ 4 && a_href_value !== (a_href_value = /*link*/ ctx[7].url)) {
				attr(a, "href", a_href_value);
			}

			if (!current || dirty & /*social_links*/ 4 && a_aria_label_value !== (a_aria_label_value = /*icon*/ ctx[8])) {
				attr(a, "aria-label", a_aria_label_value);
			}
		},
		i(local) {
			if (current) return;
			transition_in(icon.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(icon.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(li);
			destroy_component(icon);
		}
	};
}

function create_fragment$6(ctx) {
	let div3;
	let footer;
	let div2;
	let div0;
	let h2;
	let t0;
	let t1;
	let a0;
	let icon;
	let t2;
	let span0;
	let t3;
	let a0_href_value;
	let t4;
	let hr;
	let t5;
	let div1;
	let span1;
	let t6;
	let t7_value = new Date().getFullYear() + "";
	let t7;
	let t8;
	let span2;
	let a1;
	let t9;
	let t10;
	let t11;
	let ul;
	let current;
	icon = new Component$1({ props: { icon: "mdi:envelope" } });
	let each_value = /*social_links*/ ctx[2];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			div3 = element("div");
			footer = element("footer");
			div2 = element("div");
			div0 = element("div");
			h2 = element("h2");
			t0 = text(/*heading*/ ctx[0]);
			t1 = space();
			a0 = element("a");
			create_component(icon.$$.fragment);
			t2 = space();
			span0 = element("span");
			t3 = text(/*email*/ ctx[1]);
			t4 = space();
			hr = element("hr");
			t5 = space();
			div1 = element("div");
			span1 = element("span");
			t6 = text("Copyright ");
			t7 = text(t7_value);
			t8 = space();
			span2 = element("span");
			a1 = element("a");
			t9 = text("Primo");
			t10 = text(" Powered");
			t11 = space();
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			div3 = claim_element(nodes, "DIV", { class: true, id: true });
			var div3_nodes = children(div3);
			footer = claim_element(div3_nodes, "FOOTER", {});
			var footer_nodes = children(footer);
			div2 = claim_element(footer_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			div0 = claim_element(div2_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			h2 = claim_element(div0_nodes, "H2", { class: true });
			var h2_nodes = children(h2);
			t0 = claim_text(h2_nodes, /*heading*/ ctx[0]);
			h2_nodes.forEach(detach);
			t1 = claim_space(div0_nodes);
			a0 = claim_element(div0_nodes, "A", { class: true, href: true });
			var a0_nodes = children(a0);
			claim_component(icon.$$.fragment, a0_nodes);
			t2 = claim_space(a0_nodes);
			span0 = claim_element(a0_nodes, "SPAN", { class: true });
			var span0_nodes = children(span0);
			t3 = claim_text(span0_nodes, /*email*/ ctx[1]);
			span0_nodes.forEach(detach);
			a0_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t4 = claim_space(div2_nodes);
			hr = claim_element(div2_nodes, "HR", {});
			t5 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			span1 = claim_element(div1_nodes, "SPAN", { class: true });
			var span1_nodes = children(span1);
			t6 = claim_text(span1_nodes, "Copyright ");
			t7 = claim_text(span1_nodes, t7_value);
			span1_nodes.forEach(detach);
			t8 = claim_space(div1_nodes);
			span2 = claim_element(div1_nodes, "SPAN", { class: true });
			var span2_nodes = children(span2);
			a1 = claim_element(span2_nodes, "A", { href: true, class: true });
			var a1_nodes = children(a1);
			t9 = claim_text(a1_nodes, "Primo");
			a1_nodes.forEach(detach);
			t10 = claim_text(span2_nodes, " Powered");
			span2_nodes.forEach(detach);
			t11 = claim_space(div1_nodes);
			ul = claim_element(div1_nodes, "UL", { class: true });
			var ul_nodes = children(ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(ul_nodes);
			}

			ul_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			footer_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h2, "class", "heading");
			attr(span0, "class", "svelte-i8f0ga");
			attr(a0, "class", "email svelte-i8f0ga");
			attr(a0, "href", a0_href_value = "mailto:" + /*email*/ ctx[1]);
			attr(div0, "class", "primary svelte-i8f0ga");
			attr(span1, "class", "copyright svelte-i8f0ga");
			attr(a1, "href", "https://primo.so");
			attr(a1, "class", "svelte-i8f0ga");
			attr(span2, "class", "primo svelte-i8f0ga");
			attr(ul, "class", "svelte-i8f0ga");
			attr(div1, "class", "secondary svelte-i8f0ga");
			attr(div2, "class", "section-container svelte-i8f0ga");
			attr(div3, "class", "section");
			attr(div3, "id", "section-66bba149");
		},
		m(target, anchor) {
			insert_hydration(target, div3, anchor);
			append_hydration(div3, footer);
			append_hydration(footer, div2);
			append_hydration(div2, div0);
			append_hydration(div0, h2);
			append_hydration(h2, t0);
			append_hydration(div0, t1);
			append_hydration(div0, a0);
			mount_component(icon, a0, null);
			append_hydration(a0, t2);
			append_hydration(a0, span0);
			append_hydration(span0, t3);
			append_hydration(div2, t4);
			append_hydration(div2, hr);
			append_hydration(div2, t5);
			append_hydration(div2, div1);
			append_hydration(div1, span1);
			append_hydration(span1, t6);
			append_hydration(span1, t7);
			append_hydration(div1, t8);
			append_hydration(div1, span2);
			append_hydration(span2, a1);
			append_hydration(a1, t9);
			append_hydration(span2, t10);
			append_hydration(div1, t11);
			append_hydration(div1, ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(ul, null);
				}
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (!current || dirty & /*heading*/ 1) set_data(t0, /*heading*/ ctx[0]);
			if (!current || dirty & /*email*/ 2) set_data(t3, /*email*/ ctx[1]);

			if (!current || dirty & /*email*/ 2 && a0_href_value !== (a0_href_value = "mailto:" + /*email*/ ctx[1])) {
				attr(a0, "href", a0_href_value);
			}

			if (dirty & /*social_links*/ 4) {
				each_value = /*social_links*/ ctx[2];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$3(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$3(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(ul, null);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(icon.$$.fragment, local);

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			transition_out(icon.$$.fragment, local);
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(div3);
			destroy_component(icon);
			destroy_each(each_blocks, detaching);
		}
	};
}

function instance$6($$self, $$props, $$invalidate) {
	let { favicon } = $$props;
	let { site_nav } = $$props;
	let { title } = $$props;
	let { description } = $$props;
	let { heading } = $$props;
	let { email } = $$props;
	let { social_links } = $$props;

	$$self.$$set = $$props => {
		if ('favicon' in $$props) $$invalidate(3, favicon = $$props.favicon);
		if ('site_nav' in $$props) $$invalidate(4, site_nav = $$props.site_nav);
		if ('title' in $$props) $$invalidate(5, title = $$props.title);
		if ('description' in $$props) $$invalidate(6, description = $$props.description);
		if ('heading' in $$props) $$invalidate(0, heading = $$props.heading);
		if ('email' in $$props) $$invalidate(1, email = $$props.email);
		if ('social_links' in $$props) $$invalidate(2, social_links = $$props.social_links);
	};

	return [heading, email, social_links, favicon, site_nav, title, description];
}

class Component$6 extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
			favicon: 3,
			site_nav: 4,
			title: 5,
			description: 6,
			heading: 0,
			email: 1,
			social_links: 2
		});
	}
}

/* generated by Svelte v3.58.0 */

function instance$7($$self, $$props, $$invalidate) {
	let { favicon } = $$props;
	let { site_nav } = $$props;
	let { title } = $$props;
	let { description } = $$props;

	$$self.$$set = $$props => {
		if ('favicon' in $$props) $$invalidate(0, favicon = $$props.favicon);
		if ('site_nav' in $$props) $$invalidate(1, site_nav = $$props.site_nav);
		if ('title' in $$props) $$invalidate(2, title = $$props.title);
		if ('description' in $$props) $$invalidate(3, description = $$props.description);
	};

	return [favicon, site_nav, title, description];
}

class Component$7 extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance$7, null, safe_not_equal, {
			favicon: 0,
			site_nav: 1,
			title: 2,
			description: 3
		});
	}
}

/* generated by Svelte v3.58.0 */

function create_fragment$7(ctx) {
	let component_0;
	let t0;
	let component_1;
	let t1;
	let component_2;
	let t2;
	let component_3;
	let t3;
	let component_4;
	let t4;
	let component_5;
	let t5;
	let component_6;
	let current;

	component_0 = new Component({
			props: {
				favicon: {
					"alt": "",
					"src": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGP0lEQVR42q1XA7AkyxKdNedNT49xd69t32+bzzbXtm3btm3btr3Bb1zlz5PRPVF/FhfxJiJnprOr8pxEZVVZXvKpwVLHfGjcuLHbbre/r2naTP49wvKQpdSQh9Dpuo5372OsYqe22KriB5Pkw0aTWWaz4b/xL5nCz6RK2DuMneVwOJLCbFb8Ubyuwd6OgHEFsNgQeF2mECiDznyvzmEbI9lWTcV2xeA2my2KJ19UgP/LUs5ClZRyzFGIXGQikRWRkBc8OJ3l78bE/5ieVlPKYMOw9XcmkfEiErVNzxVw8eBbEpVEZHhNmBVakwdcUDynCkUzRK8Uif+a6QCWii3hQLGEg4thp/58YAfr/S6y+1gwTwsHDJurRALF/X9RwHIJFY/O8oomhgWgnpX0gJsEwMZ6r5P02ID8t1ksInaXg0Tndoheii/oJq1OY9IjPGT3OEWv1hOWt0VZ67NZSJaQVSOZbKkvxvVIXwhEiLDRRvyMcd4/5pPntzk8tgZ0GAOCErlXMDfGL79wCHr8mqlgmSXgbrfbw8q/Shgb28r0SC/AWSyUurYrZZ8cTsEWvwIJ1jXgMRolzGhGWUeGUO75MZRzbjRlHhxEsWM+xRh4K6DRA96V90kL25AVerc4ABKIsjQr6ZhonTryabWV6E29Ic/TNvegvBuTKO/OFIqf/g01ZJ0zL44y9vSngrvTqODOVPwq/6dS6oZuEplGIL+xOxU+nEH5tyZT8rIO1BgkfJw+vwskioEJbIvG/Vu3MaMmnuJw8JzL4yh1W09y5sbCACIigHnXJlLW4SGUMLMZJc5tSdknhouu4N40SpzTkhrwWO/rRRK9fLaTf2sKJS9tDxuIEKRY5zoAtsVu403Ej5zXKVHBc6+Op7QdvcmR2lQmBj75CeVdmUD5NydTxs6+ZK8ptSCRcX03CYTE25yzo8n9i0x5532tkHJOjZQ5BbeZxJJ2SAdqpFQHEd7ALFw4D3W3AzkvS13XlcTIhdHiuSMtUoBAIHbUJ5TPRuBpsNkvRefIimaJEY+j+r8jc/OvT6Kmnf8sdQABiayjQynv6gRJVeL81tCXcbqxsh5a7AFXKTx3/zyDci+NY/AxlH1+FAVb/1a8cH43UbyMn/q15Dn3wljyvloQKjg9LiD/I5r/GuSERFS/t2Wu6wfJVJd/uUA5CiA3kXJOjyS7pZHZZ0otEo4mHmEbO/4zzvtYyjgxjFL39Sfvhz9EZMTb+ClfmQTEK1mi8UGscwGJn/YNwiyeRrT4NdmMeZG93qS8y+NBTuohqu9bgoXVxr2hFKvgoVSk11mGCTFjPqF0JpByaCAlchq8H/yA6rMeK8Ek4OMCsxoh1iw1xWPo4T2WJ8LbUMDfACGkBcJL8x1EBuBlRgQeIgJHdDy49BKwsmLi8A8oeX8/it/Wg2LXdiItJUhx4z+XFZB7cSx5fp9HjsxoSl3fjQElv6Fqj+z9phCO7P4aFy17zmFH6AEOUnpihHhuNL4j2ANmcASgLOaCBDvxLGLAWxS7qQtFr+lA/smfUsKiNhJihNOZH0+RPV6noqezzT4g9RMz9APMldCnbepBRU9mSeijB74r4I6kJqGDjbEnzJRGZLApsWsa2il6guTQ3+1PFLmiLXmnfUaJ23tSARcSgLx/yCM9ykcpKzpS+rbelDCrBRdmoQDrCUGZG/j0J5S+tZfkvJFRLwBXCQA71IpDBwjN2MWwH2AZdfgdOSd+RAkbuwoBswjhqdUQANiM3o9+j9VhM/RWYz/hCCuHFKUVh29GLGSSwG6oc5FZ38qnhC3dqYBznMvd0ffmdwTAwflEJLAUsRpCW7JNNjTskEip6nnYZqScfJWzHMRcp2JEltPg9yTf2ceGkSM9SjYmIWnVIM8/M1htqueq92SemNUDyQj1QKIePBBSDYXZ8jdmE0J0DJJVP5rh8KMeSGqwyO8Lj2QA8TmRTxM8zLPqH8lefCgNjwTrUGTomgCv5qH0b8BQMSs+lqs1UXUpV0/EsF3R3aCuEgmkwzRSXMX7QZkxp9ywcQE2q3Q7Qp5QLGFXsxLDcEn41Ux9p85BcatXsypfTrFcjMvpX6twOf2r0VuSq345ff713OyY72PveM71/BF0xtX9fYwNi+gLr+f/A6i9qhE6OU++AAAAAElFTkSuQmCC",
					"url": "data:image/png;base64,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",
					"size": null
				},
				site_nav: [
					{
						"link": {
							"url": "/",
							"label": "Home",
							"active": false
						}
					},
					{
						"link": { "url": "/projects", "label": "Projects" }
					}
				],
				title: "Portfolio Theme",
				description: "Cupidatat est tempor"
			}
		});

	component_1 = new Component$2({
			props: {
				favicon: {
					"alt": "",
					"src": "data:image/png;base64,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",
					"url": "data:image/png;base64,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",
					"size": null
				},
				site_nav: [
					{
						"link": {
							"url": "/",
							"label": "Home",
							"active": false
						}
					},
					{
						"link": { "url": "/projects", "label": "Projects" }
					}
				],
				title: "Portfolio Theme",
				description: {
					"html": "<p>Passionate svelte enthusiast with a knack for making web apps and mobile game apps.</p>",
					"markdown": "Passionate svelte enthusiast with a knack for making web apps and mobile game apps.\n\n"
				},
				portrait: {
					"image": {
						"alt": "Profile photo of me",
						"src": "https://images.unsplash.com/photo-1556015048-4d3aa10df74c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=928&q=80",
						"url": "https://images.unsplash.com/photo-1556015048-4d3aa10df74c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=928&q=80",
						"size": null
					},
					"variation": "circle"
				},
				name: "Georg Hartmann",
				social_links: [
					{
						"icon": "mdi:twitter",
						"link": {
							"url": "https://twitter.com",
							"label": "Twitter",
							"active": false
						}
					},
					{
						"icon": "mdi:github",
						"link": {
							"url": "https://github.com",
							"label": "Github",
							"active": false
						}
					}
				]
			}
		});

	component_2 = new Component$3({
			props: {
				favicon: {
					"alt": "",
					"src": "data:image/png;base64,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",
					"url": "data:image/png;base64,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",
					"size": null
				},
				site_nav: [
					{
						"link": {
							"url": "/",
							"label": "Home",
							"active": false
						}
					},
					{
						"link": { "url": "/projects", "label": "Projects" }
					}
				],
				title: "Portfolio Theme",
				description: "Cupidatat est tempor",
				content: {
					"html": "<h2>Welcome to my portfolio</h2><p>This is some copy to help you get to know about my interests, experience, and top projects. I may share a few personal things here too.</p>",
					"markdown": "## Welcome to my portfolio\n\nThis is some copy to help you get to know about my interests, experience, and top projects. I may share a few personal things here too.\n\n"
				}
			}
		});

	component_3 = new Component$4({
			props: {
				favicon: {
					"alt": "",
					"src": "data:image/png;base64,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",
					"url": "data:image/png;base64,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",
					"size": null
				},
				site_nav: [
					{
						"link": {
							"url": "/",
							"label": "Home",
							"active": false
						}
					},
					{
						"link": { "url": "/projects", "label": "Projects" }
					}
				],
				title: "Portfolio Theme",
				description: "Cupidatat est tempor",
				heading: "Featured Projects",
				items: [
					{
						"date": "01.01.22",
						"links": [
							{
								"link": { "url": "/", "label": "Visit Site" }
							}
						],
						"title": "First project",
						"thumbnail": {
							"alt": "Mountain",
							"src": "https://images.unsplash.com/photo-1653972677660-71217674c326?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&q=80",
							"url": "https://images.unsplash.com/photo-1653972677660-71217674c326?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&q=80",
							"size": null
						},
						"description": {
							"html": "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Viverra senectus ipsum a non. Malesuada magna etiam great dignissim curabitur aliquam.</p>",
							"markdown": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Viverra senectus ipsum a non. Malesuada magna etiam great dignissim curabitur aliquam.\n"
						}
					},
					{
						"date": "01.01.22",
						"links": [
							{
								"link": {
									"url": "/second-project",
									"label": "Visit Site"
								}
							}
						],
						"title": "Second project",
						"thumbnail": {
							"alt": "Mountains by the sea",
							"src": "https://images.unsplash.com/photo-1649087921869-4ea8cf7364bd?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&q=80",
							"url": "https://images.unsplash.com/photo-1649087921869-4ea8cf7364bd?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&q=80",
							"size": null
						},
						"description": {
							"html": "<p>Magna reprehenderit occaecat proident. Magna est quis sunt nisi ullamco amet commodo.</p>",
							"markdown": "Magna reprehenderit occaecat proident. Magna est quis sunt nisi ullamco amet commodo."
						}
					}
				]
			}
		});

	component_4 = new Component$5({
			props: {
				favicon: {
					"alt": "",
					"src": "data:image/png;base64,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",
					"url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGP0lEQVR42q1XA7AkyxKdNedNT49xd69t32+bzzbXtm3btm3btr3Bb1zlz5PRPVF/FhfxJiJnprOr8pxEZVVZXvKpwVLHfGjcuLHbbre/r2naTP49wvKQpdSQh9Dpuo5372OsYqe22KriB5Pkw0aTWWaz4b/xL5nCz6RK2DuMneVwOJLCbFb8Ubyuwd6OgHEFsNgQeF2mECiDznyvzmEbI9lWTcV2xeA2my2KJ19UgP/LUs5ClZRyzFGIXGQikRWRkBc8OJ3l78bE/5ieVlPKYMOw9XcmkfEiErVNzxVw8eBbEpVEZHhNmBVakwdcUDynCkUzRK8Uif+a6QCWii3hQLGEg4thp/58YAfr/S6y+1gwTwsHDJurRALF/X9RwHIJFY/O8oomhgWgnpX0gJsEwMZ6r5P02ID8t1ksInaXg0Tndoheii/oJq1OY9IjPGT3OEWv1hOWt0VZ67NZSJaQVSOZbKkvxvVIXwhEiLDRRvyMcd4/5pPntzk8tgZ0GAOCErlXMDfGL79wCHr8mqlgmSXgbrfbw8q/Shgb28r0SC/AWSyUurYrZZ8cTsEWvwIJ1jXgMRolzGhGWUeGUO75MZRzbjRlHhxEsWM+xRh4K6DRA96V90kL25AVerc4ABKIsjQr6ZhonTryabWV6E29Ic/TNvegvBuTKO/OFIqf/g01ZJ0zL44y9vSngrvTqODOVPwq/6dS6oZuEplGIL+xOxU+nEH5tyZT8rIO1BgkfJw+vwskioEJbIvG/Vu3MaMmnuJw8JzL4yh1W09y5sbCACIigHnXJlLW4SGUMLMZJc5tSdknhouu4N40SpzTkhrwWO/rRRK9fLaTf2sKJS9tDxuIEKRY5zoAtsVu403Ej5zXKVHBc6+Op7QdvcmR2lQmBj75CeVdmUD5NydTxs6+ZK8ptSCRcX03CYTE25yzo8n9i0x5532tkHJOjZQ5BbeZxJJ2SAdqpFQHEd7ALFw4D3W3AzkvS13XlcTIhdHiuSMtUoBAIHbUJ5TPRuBpsNkvRefIimaJEY+j+r8jc/OvT6Kmnf8sdQABiayjQynv6gRJVeL81tCXcbqxsh5a7AFXKTx3/zyDci+NY/AxlH1+FAVb/1a8cH43UbyMn/q15Dn3wljyvloQKjg9LiD/I5r/GuSERFS/t2Wu6wfJVJd/uUA5CiA3kXJOjyS7pZHZZ0otEo4mHmEbO/4zzvtYyjgxjFL39Sfvhz9EZMTb+ClfmQTEK1mi8UGscwGJn/YNwiyeRrT4NdmMeZG93qS8y+NBTuohqu9bgoXVxr2hFKvgoVSk11mGCTFjPqF0JpByaCAlchq8H/yA6rMeK8Ek4OMCsxoh1iw1xWPo4T2WJ8LbUMDfACGkBcJL8x1EBuBlRgQeIgJHdDy49BKwsmLi8A8oeX8/it/Wg2LXdiItJUhx4z+XFZB7cSx5fp9HjsxoSl3fjQElv6Fqj+z9phCO7P4aFy17zmFH6AEOUnpihHhuNL4j2ANmcASgLOaCBDvxLGLAWxS7qQtFr+lA/smfUsKiNhJihNOZH0+RPV6noqezzT4g9RMz9APMldCnbepBRU9mSeijB74r4I6kJqGDjbEnzJRGZLApsWsa2il6guTQ3+1PFLmiLXmnfUaJ23tSARcSgLx/yCM9ykcpKzpS+rbelDCrBRdmoQDrCUGZG/j0J5S+tZfkvJFRLwBXCQA71IpDBwjN2MWwH2AZdfgdOSd+RAkbuwoBswjhqdUQANiM3o9+j9VhM/RWYz/hCCuHFKUVh29GLGSSwG6oc5FZ38qnhC3dqYBznMvd0ffmdwTAwflEJLAUsRpCW7JNNjTskEip6nnYZqScfJWzHMRcp2JEltPg9yTf2ceGkSM9SjYmIWnVIM8/M1htqueq92SemNUDyQj1QKIePBBSDYXZ8jdmE0J0DJJVP5rh8KMeSGqwyO8Lj2QA8TmRTxM8zLPqH8lefCgNjwTrUGTomgCv5qH0b8BQMSs+lqs1UXUpV0/EsF3R3aCuEgmkwzRSXMX7QZkxp9ywcQE2q3Q7Qp5QLGFXsxLDcEn41Ux9p85BcatXsypfTrFcjMvpX6twOf2r0VuSq345ff713OyY72PveM71/BF0xtX9fYwNi+gLr+f/A6i9qhE6OU++AAAAAElFTkSuQmCC",
					"size": null
				},
				site_nav: [
					{
						"link": {
							"url": "/",
							"label": "Home",
							"active": false
						}
					},
					{
						"link": { "url": "/projects", "label": "Projects" }
					}
				],
				title: "Portfolio Theme",
				description: {
					"html": "<p>Some technologies i’ve been using lately:</p>",
					"markdown": "Some technologies i’ve been using lately:\n\n"
				},
				heading: "Skills",
				items: [
					{
						"icon": "akar-icons:javascript-fill",
						"label": "JavaScript"
					},
					{ "icon": "cib:svelte", "label": "Svelte" },
					{
						"icon": "fontisto:html5",
						"label": "HTML"
					},
					{
						"icon": "mdi:language-css3",
						"label": "CSS"
					}
				]
			}
		});

	component_5 = new Component$6({
			props: {
				favicon: {
					"alt": "",
					"src": "data:image/png;base64,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",
					"url": "data:image/png;base64,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",
					"size": null
				},
				site_nav: [
					{
						"link": {
							"url": "/",
							"label": "Home",
							"active": false
						}
					},
					{
						"link": { "url": "/projects", "label": "Projects" }
					}
				],
				title: "Portfolio Theme",
				description: "Cupidatat est tempor",
				heading: "Get in touch",
				email: "someone@somewhere.com",
				social_links: [
					{
						"icon": "mdi:twitter",
						"link": {
							"url": "https://twitter.com",
							"label": "Twitter",
							"active": false
						}
					},
					{
						"icon": "mdi:github",
						"link": {
							"url": "https://github.com",
							"label": "Github",
							"active": false
						}
					}
				]
			}
		});

	component_6 = new Component$7({
			props: {
				favicon: {
					"alt": "",
					"src": "data:image/png;base64,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",
					"url": "data:image/png;base64,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",
					"size": null
				},
				site_nav: [
					{
						"link": {
							"url": "/",
							"label": "Home",
							"active": false
						}
					},
					{
						"link": { "url": "/projects", "label": "Projects" }
					}
				],
				title: "Portfolio Theme",
				description: "Cupidatat est tempor"
			}
		});

	return {
		c() {
			create_component(component_0.$$.fragment);
			t0 = space();
			create_component(component_1.$$.fragment);
			t1 = space();
			create_component(component_2.$$.fragment);
			t2 = space();
			create_component(component_3.$$.fragment);
			t3 = space();
			create_component(component_4.$$.fragment);
			t4 = space();
			create_component(component_5.$$.fragment);
			t5 = space();
			create_component(component_6.$$.fragment);
		},
		l(nodes) {
			claim_component(component_0.$$.fragment, nodes);
			t0 = claim_space(nodes);
			claim_component(component_1.$$.fragment, nodes);
			t1 = claim_space(nodes);
			claim_component(component_2.$$.fragment, nodes);
			t2 = claim_space(nodes);
			claim_component(component_3.$$.fragment, nodes);
			t3 = claim_space(nodes);
			claim_component(component_4.$$.fragment, nodes);
			t4 = claim_space(nodes);
			claim_component(component_5.$$.fragment, nodes);
			t5 = claim_space(nodes);
			claim_component(component_6.$$.fragment, nodes);
		},
		m(target, anchor) {
			mount_component(component_0, target, anchor);
			insert_hydration(target, t0, anchor);
			mount_component(component_1, target, anchor);
			insert_hydration(target, t1, anchor);
			mount_component(component_2, target, anchor);
			insert_hydration(target, t2, anchor);
			mount_component(component_3, target, anchor);
			insert_hydration(target, t3, anchor);
			mount_component(component_4, target, anchor);
			insert_hydration(target, t4, anchor);
			mount_component(component_5, target, anchor);
			insert_hydration(target, t5, anchor);
			mount_component(component_6, target, anchor);
			current = true;
		},
		p: noop,
		i(local) {
			if (current) return;
			transition_in(component_0.$$.fragment, local);
			transition_in(component_1.$$.fragment, local);
			transition_in(component_2.$$.fragment, local);
			transition_in(component_3.$$.fragment, local);
			transition_in(component_4.$$.fragment, local);
			transition_in(component_5.$$.fragment, local);
			transition_in(component_6.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(component_0.$$.fragment, local);
			transition_out(component_1.$$.fragment, local);
			transition_out(component_2.$$.fragment, local);
			transition_out(component_3.$$.fragment, local);
			transition_out(component_4.$$.fragment, local);
			transition_out(component_5.$$.fragment, local);
			transition_out(component_6.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(component_0, detaching);
			if (detaching) detach(t0);
			destroy_component(component_1, detaching);
			if (detaching) detach(t1);
			destroy_component(component_2, detaching);
			if (detaching) detach(t2);
			destroy_component(component_3, detaching);
			if (detaching) detach(t3);
			destroy_component(component_4, detaching);
			if (detaching) detach(t4);
			destroy_component(component_5, detaching);
			if (detaching) detach(t5);
			destroy_component(component_6, detaching);
		}
	};
}

class Component$8 extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment$7, safe_not_equal, {});
	}
}

export default Component$8;
