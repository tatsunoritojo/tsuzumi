module.exports = function (api) {
    api.cache.using(() => process.env.NODE_ENV);
    const plugins = [
        'react-native-reanimated/plugin',
    ];

    if (process.env.NODE_ENV === 'production') {
        plugins.push('transform-remove-console');
    }

    return {
        presets: ['babel-preset-expo'],
        plugins,
    };
};
