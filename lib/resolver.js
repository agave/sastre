const Injector = require('./injector');

const glob = require('glob');
const path = require('path');
const fs = require('fs');

class Resolver {
  constructor(cwd, decorator) {
    const entryFiles = glob
      .sync('**/index.js', { cwd, nosort: true })
      .sort((a, b) => a.split('/').length - b.split('/').length);

    this.decorator = typeof decorator !== 'function'
      ? ((name, definition) => definition)
      : decorator;

    this.registry = {};
    this.values = {};

    entryFiles.forEach(entry => {
      const [ value, ...properties ] = entry.split('/');
      const definition = require(path.join(cwd, entry));

      properties.pop();

      const providerFile = path.join(cwd, value, properties.join('/'), 'provider.js');
      const hasDependencies = fs.existsSync(providerFile);

      if (!this.values[value]) {
        this.values[value] = !properties.length
          ? (hasDependencies && new Injector(definition, require(providerFile)) || definition)
          : {};
      }

      this.registry[value] = this.registry[value] || {};

      let target = this.registry[value];
      let propName;

      while (properties.length) {
        propName = properties.shift();

        if (!target[propName]) {
          if (hasDependencies && !properties.length) {
            target[propName] = new Injector(definition, require(providerFile));
          } else {
            target = target[propName] = {};
          }
        }
      }
    });
  }

  unwrap(definition) {
    if (!definition || typeof definition === 'function') {
      return definition;
    }

    const target = {};

    if (Array.isArray(definition)) {
      return definition.map(x => this.unwrap(x));
    }

    Object.keys(definition).forEach(propName => {
      const value = definition[propName];

      if (Injector.supports(value)) {
        target[propName] = value.unwrap(this);
      } else {
        target[propName] = this.unwrap(definition[propName]);
      }
    });

    return target;
  }

  get(value) {
    const resolved = this.values[value];

    if (!Injector.hasLocked(resolved)) {
      const extensions = this.unwrap(this.registry[value]);

      Injector.assign(resolved, extensions);

      const decorated = this.decorator(value, resolved);

      if (decorated && decorated !== resolved) {
        this.values[value] = decorated;

        return decorated;
      }
    }

    return resolved;
  }
}

module.exports = Resolver;