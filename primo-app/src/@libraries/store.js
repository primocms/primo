import store from 'store2'

const _ = store._

_.on = function(key, fn) {
    if (!fn) { fn = key; key = ''; }// no key === all keys
    var s = this,
        listener = function(e) {
        var k = s._out(e.key);// undefined if key is not in the namespace
        if ((k && (k === key ||// match key if listener has one
                    (!key && k !== '_-bad-_'))) &&// match catch-all, except internal test
            (!e.storageArea || e.storageArea === s._area)) {// match area, if available
            return fn.call(s, _.event.call(s, k, e));
        }
    };
    window.addEventListener("storage", fn[key+'-listener']=listener, false);
    return this;
};

_.off = function(key, fn) {
    if (!fn) { fn = key; key = ''; }// no key === all keys
    window.removeEventListener("storage", fn[key+'-listener']);
    return this;
};

_.once = function(key, fn) {
    if (!fn) { fn = key; key = ''; }
    var s = this, listener;
    return s.on(key, listener = function() {
        s.off(key, listener);
        return fn.apply(this, arguments);
    });
};

_.event = function(k, e) {
    var event = {
        key: k,
        namespace: this.namespace(),
        newValue: _.parse(e.newValue),
        oldValue: _.parse(e.oldValue),
        url: e.url || e.uri,
        storageArea: e.storageArea,
        source: e.source,
        timeStamp: e.timeStamp,
        originalEvent: e
    };
    if (_.cache) {
        var min = _.expires(e.newValue || e.oldValue);
        if (min) {
            event.expires = _.when(min);
        }
    }
    return event;
};

// store2 policy is to not throw errors on old browsers
var old = !window.addEventListener ? function(){} : null;
_.fn('on', old || _.on);
_.fn('off', old || _.off);
_.fn('once', old || _.once);

store._ = _

export default store