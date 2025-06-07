// Example next.config.js with the DevTools JSON plugin

const withDevToolsJSON = require('next-plugin-devtools-json');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing Next.js configuration
  reactStrictMode: true,
  
  // Other configuration options...
};

// Wrap your config with the DevTools JSON plugin
module.exports = withDevToolsJSON({
  // Optional: Provide a custom UUID (otherwise one will be generated and cached)
  // uuid: 'your-custom-uuid-here',
  
  // Optional: Control when the plugin is enabled (defaults to development mode only)
  // enabled: process.env.NODE_ENV === 'development',
})(nextConfig);

// Alternative ES modules syntax (next.config.mjs):
/*
import withDevToolsJSON from 'next-plugin-devtools-json';

const nextConfig = {
  reactStrictMode: true,
};

export default withDevToolsJSON()(nextConfig);
*/
