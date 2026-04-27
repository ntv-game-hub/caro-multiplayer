module.exports = {
  apps: [
    {
      name: "caro-multiplayer",
      script: "dist/server/index.js",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      watch: false,
      autorestart: true,
      max_memory_restart: "300M",
      time: true,
      env: {
        NODE_ENV: "production",
        HOST: process.env.HOST || "0.0.0.0",
        PORT: process.env.PORT || "3000"
      }
    }
  ]
};
