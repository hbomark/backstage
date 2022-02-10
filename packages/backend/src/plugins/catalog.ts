/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Entity,
  LOCATION_ANNOTATION,
  ORIGIN_LOCATION_ANNOTATION,
} from '@backstage/catalog-model';
import {
  CatalogBuilder,
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-backend';
import { ScaffolderEntitiesProcessor } from '@backstage/plugin-scaffolder-backend';
import { Router } from 'express';
import { PluginEnvironment } from '../types';

class HeavyProvider implements EntityProvider {
  private connection: EntityProviderConnection | undefined = undefined;

  getProviderName(): string {
    return 'heavy';
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  async run() {
    const entities = new Array<Entity>();
    for (let i = 0; i < 1000; ++i) {
      entities.push({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          namespace: 'default',
          name: `e${i}`,
          annotations: {
            [LOCATION_ANNOTATION]: `url:https://example.com/${i}`,
            [ORIGIN_LOCATION_ANNOTATION]: `url:https://example.com/${i}`,
          },
        },
        spec: {
          type: 'service',
          lifecycle: 'production',
          owner: 'me',
        },
      });

      await this.connection?.applyMutation({
        type: 'full',
        entities: entities.map(e => ({ entity: e, locationKey: 'heavy' })),
      });
    }
  }
}

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const builder = await CatalogBuilder.create(env);
  const heavy = new HeavyProvider();
  builder.addProcessor(new ScaffolderEntitiesProcessor());
  builder.addEntityProvider(heavy);
  const { processingEngine, router } = await builder.build();
  await processingEngine.start();

  for (let i = 0; i < 100; ++i) {
    const start = Date.now();
    await heavy.run();
    env.logger.info('############################################');
    env.logger.info(
      `#${i}: ${((Date.now() - start) / 1000).toFixed(1)} s taken`,
    );
    env.logger.info('############################################');
  }

  return router;
}
