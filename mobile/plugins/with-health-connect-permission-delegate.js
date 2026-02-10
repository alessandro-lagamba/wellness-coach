const {
  withMainActivity,
  withAndroidManifest,
  createRunOncePlugin,
} = require('@expo/config-plugins');

const PLUGIN_NAME = 'with-health-connect-permission-delegate';
const PLUGIN_VERSION = '1.1.0';
const DELEGATE_IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const DELEGATE_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';
const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';
const RATIONALE_ACTION = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';
const VIEW_PERMISSION_USAGE_ACTION = 'android.intent.action.VIEW_PERMISSION_USAGE';
const VIEW_PERMISSION_USAGE_CATEGORY = 'android.intent.category.HEALTH_PERMISSIONS';
const VIEW_PERMISSION_USAGE_PERMISSION = 'android.permission.START_VIEW_PERMISSION_USAGE';
const VIEW_PERMISSION_USAGE_ALIAS = '.ViewPermissionUsageActivity';

function withHealthConnectPermissionDelegate(config) {
  config = withMainActivity(config, (config) => {
    if (config.modResults.language === 'kt') {
      let contents = config.modResults.contents;

      if (!contents.includes(DELEGATE_IMPORT)) {
        const importAnchor = 'import expo.modules.ReactActivityDelegateWrapper';
        if (contents.includes(importAnchor)) {
          contents = contents.replace(
            importAnchor,
            `${importAnchor}\n${DELEGATE_IMPORT}`
          );
        } else {
          contents = `${DELEGATE_IMPORT}\n${contents}`;
        }
      }

      if (!contents.includes(DELEGATE_CALL)) {
        const superOnCreateRegex = /super\.onCreate\((?:null|savedInstanceState)\)/;
        if (superOnCreateRegex.test(contents)) {
          contents = contents.replace(
            superOnCreateRegex,
            (match) => `${match}\n    ${DELEGATE_CALL}`
          );
        }
      }

      config.modResults.contents = contents;
    }

    return config;
  });

  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const app = manifest?.application?.[0];

    if (!manifest || !app) {
      return config;
    }

    if (!Array.isArray(manifest.queries)) {
      manifest.queries = [];
    }

    const hasHealthConnectQuery = manifest.queries.some((query) =>
      Array.isArray(query.package) &&
      query.package.some(
        (pkg) => pkg?.$?.['android:name'] === HEALTH_CONNECT_PACKAGE
      )
    );

    if (!hasHealthConnectQuery) {
      let queryNode = manifest.queries.find((query) => Array.isArray(query.package));
      if (!queryNode) {
        queryNode = {};
        manifest.queries.push(queryNode);
      }
      if (!Array.isArray(queryNode.package)) {
        queryNode.package = [];
      }
      queryNode.package.push({
        $: { 'android:name': HEALTH_CONNECT_PACKAGE },
      });
    }

    if (!Array.isArray(app.activity)) {
      app.activity = [];
    }

    const mainActivity = app.activity.find((activity) => {
      const filters = activity?.['intent-filter'] || [];
      return filters.some((filter) => {
        const actions = filter?.action || [];
        return actions.some(
          (action) => action?.$?.['android:name'] === 'android.intent.action.MAIN'
        );
      });
    }) || app.activity[0];

    if (mainActivity) {
      if (!Array.isArray(mainActivity['intent-filter'])) {
        mainActivity['intent-filter'] = [];
      }

      const hasRationaleIntent = mainActivity['intent-filter'].some((filter) => {
        const actions = filter?.action || [];
        return actions.some(
          (action) => action?.$?.['android:name'] === RATIONALE_ACTION
        );
      });

      if (!hasRationaleIntent) {
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': RATIONALE_ACTION } }],
        });
      }
    }

    if (!Array.isArray(app['activity-alias'])) {
      app['activity-alias'] = [];
    }

    const hasViewPermissionUsageAlias = app['activity-alias'].some((alias) => {
      const actions = (alias?.['intent-filter'] || [])
        .flatMap((filter) => filter?.action || []);
      return actions.some(
        (action) => action?.$?.['android:name'] === VIEW_PERMISSION_USAGE_ACTION
      );
    });

    if (!hasViewPermissionUsageAlias) {
      const mainActivityName = mainActivity?.$?.['android:name'] || '.MainActivity';
      app['activity-alias'].push({
        $: {
          'android:name': VIEW_PERMISSION_USAGE_ALIAS,
          'android:exported': 'true',
          'android:targetActivity': mainActivityName,
          'android:permission': VIEW_PERMISSION_USAGE_PERMISSION,
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': VIEW_PERMISSION_USAGE_ACTION } }],
            category: [{ $: { 'android:name': VIEW_PERMISSION_USAGE_CATEGORY } }],
          },
        ],
      });
    }

    return config;
  });

  return config;
}

module.exports = createRunOncePlugin(
  withHealthConnectPermissionDelegate,
  PLUGIN_NAME,
  PLUGIN_VERSION
);
