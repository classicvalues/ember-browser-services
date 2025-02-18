import Service from '@ember/service';

import window from 'ember-window-mock';
import { setupWindowMock } from 'ember-window-mock/test-support';

import { proxyService } from '../services/browser/-proxy-service';
import { FakeLocalStorageService, FakeSessionStorageService } from './-private/web-storage';
import { patchWindow } from './window-mock-augments';

import type { RecursivePartial } from '../types';
import type { TestContext } from '@ember/test-helpers';

type Fakes = {
  window?: boolean | typeof Service | RecursivePartial<Window>;
  localStorage?: boolean;
  sessionStorage?: boolean;
  document?: boolean | typeof Service | RecursivePartial<Document>;
  navigator?: boolean | RecursivePartial<Navigator>;
};

export function setupBrowserFakes(hooks: NestedHooks, options: Fakes): void {
  setupWindowMock(hooks);

  hooks.beforeEach(function (this: TestContext) {
    // the type for the owner keeps being wrong............
    let owner = this.owner as unknown as {
      register: (name: string, thing: unknown) => void;
      unregister: (name: string) => void;
    };

    if (options.window) {
      // default, can still be overwritten
      // see: https://github.com/kaliber5/ember-window-mock/issues/175
      let patched = patchWindow(window);
      let service = maybeMake(options.window, patched);

      owner.register('service:browser/window', service);
    }

    if (options.document) {
      let service = maybeMake(options.document, window.document);

      owner.register('service:browser/document', service);
    }

    if (options.localStorage) {
      owner.register('service:browser/local-storage', FakeLocalStorageService);
    }

    if (options.sessionStorage) {
      owner.register('service:browser/session-storage', FakeSessionStorageService);
    }

    if (options.navigator) {
      let service = maybeMake(options.navigator, window.navigator);

      owner.register('service:browser/navigator', service);
    }
  });
}

// this usage of any is correct, because it literally could be *any*thing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnknownObject = Record<string, any>;

export function maybeMake<DefaultType extends UnknownObject, TestClass extends UnknownObject>(
  maybeImplementation: true | typeof Service | TestClass | RecursivePartial<DefaultType>,
  target: DefaultType
): DefaultType {
  if (maybeImplementation === true) {
    return proxyService(target);
  }

  if (maybeImplementation.prototype instanceof Service) {
    return target;
  }

  if (typeof maybeImplementation === 'object') {
    applyStub(target, maybeImplementation);

    return proxyService(target);
  }

  return proxyService(target);
}

// we are already using ember-window-mock, so the proxy internal to that package will
// "just handle" setting stuff on the window
//
// NOTE:
//  - Location implementation is incomplete:
//     https://github.com/kaliber5/ember-window-mock/blob/2b8fbf581fc65e7f5455cd291497a3fdc2efdaf5/addon-test-support/-private/mock/location.js#L23
//     - does not allow setting "origin"
function applyStub(root: any, partial?: any) {
  if (!partial) return root;

  for (let key of Object.keys(partial)) {
    let value = partial[key];

    if (Array.isArray(value)) {
      root[key] = value;
    } else if (typeof value === 'object') {
      applyStub(root[key], value);
    } else {
      root[key] = value;
    }
  }
}
