const esprima = require('esprima'),
      vm = require('vm');

class Context {
    
    constructor(initialScope) {
        Object.defineProperty(this, "scope", { 
            value: Array.create([ initialScope || { } ]).compact(true), 
            enerumable: false 
        });
        
        Object.defineProperty(this, "scope", { 
            value: new Proxy(scope, {
                has: (scope, name) => this.scope.some(scope => name in scope),
                get: (scope, name) => (this.scope.find(scope => name in scope) || { })[name],
                set: (scope, name, value) => {
                    let match = this.scope.find(scope => name in scope);
                    if (match) match[name] = value;
                    else this.scope[0][name] = value;
                    return true;
                },
                ownKeys: (scope) => this.scope.map(scope => Object.keys(scope)).compact(true).unique(),
                enumerable: (scope) => this.scope.map(scope => Object.keys(scope)).compact(true).unique()[Symbol.iterator](),
                deleteProperty: (scope, name) => {
                    let match = this.scope.find(scope => name in scope);
                    if (match) {
                        delete match[name];
                        return true;
                    }
                    else return false;
                }
            }),
            enumerable: false
        });

        Object.defineProperty(this, "resolvers", { 
            value: [ ],
            enumerable: false
        });
        
        Object.defineProperty(this, "vm", { 
            value: vm.createContext(this.scope),
            enumerable: false
        });
    }
    
    async resolve(name) {
        for (let i = 0; i < this.resolvers.length; i++) {
            let resolver = this.resolvers[i];
            if (Object.isFunction(resolver)) {
                let result = await resolver(name);
                if (result) return result;
            }
            else throw new Error("Resolver " + resolver.toString() + " is not a function.");
        }
    }
    
    async reify(src) {
        let ids = esprima.tokenize(src.toString()).filter(
            token => token.type == "Identifier" && token.value[0] == "$" && token.value.length > 1
        ).map("value").unique().filter(id => this.scope[id] == null);
        
        return Promise.all(ids.map(async id => this.scope[id] = await this.resolve(id.substr(1))));
    }
    
    async evalInContext(src, file) {
        if (this.resolvers.length) await this.reify(src);
        return await vm.runInContext(src.toString(), this.vm, { filename: file });
    }
    
    async callInContext(fn) {
        if (this.resolvers.length) await this.reify(fn);
        return await vm.runInContext(`((${fn.toString()})())`, this.vm, { columnOffset: 4 });
    }
    
    async runInContext(src, file) {
        if (this.resolvers.length) await this.reify(src);
        return await vm.runInContext(`((async () => {\n${src.toString()}\n})())`, this.vm, { filename: file, lineOffset: -1 });
    }
    
    get replEval() {
        return (cmd, cxt, filename, cb) => {
            this.evalInContext(cmd).then(val => cb(null, val)).catch(e => {
                if (e.name === "SyntaxError" && /^(Unexpected end of input|Unexpected token)/.test(e.message)) cb(new repl.Recoverable(e));
                else cb(e);
            });
        };
    }
    
}
