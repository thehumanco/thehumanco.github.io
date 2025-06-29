import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace 'your-username' and 'repo-name' with your actual GitHub username and repo name
export default defineConfig({
  base: '/mecharobotics/',
  plugins: [react()],
})
