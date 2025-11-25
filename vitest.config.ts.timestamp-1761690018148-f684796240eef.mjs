// ../../vitest.config.ts
import { defineConfig } from "file:///mnt/c/Users/paytonz.FUTUREHOME/Nextcloud/Dev/GitHub/opentakeoff/node_modules/.pnpm/vitest@1.6.1_@vitest+ui@1.6.1_happy-dom@15.11.7_jsdom@25.0.1/node_modules/vitest/dist/config.js";
import { resolve } from "path";
var __vite_injected_original_dirname = "/mnt/c/Users/paytonz.FUTUREHOME/Nextcloud/Dev/GitHub/opentakeoff";
var vitest_config_default = defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/*.config.{js,ts}",
        "**/*.d.ts"
      ]
    }
  },
  resolve: {
    alias: {
      "@opentakeoff/backend": resolve(__vite_injected_original_dirname, "./apps/backend/src"),
      "@opentakeoff/frontend": resolve(__vite_injected_original_dirname, "./apps/frontend/src"),
      "@opentakeoff/ui": resolve(__vite_injected_original_dirname, "./packages/ui/src"),
      "@opentakeoff/config": resolve(__vite_injected_original_dirname, "./packages/config/src")
    }
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9tbnQvYy9Vc2Vycy9wYXl0b256LkZVVFVSRUhPTUUvTmV4dGNsb3VkL0Rldi9HaXRIdWIvb3BlbnRha2VvZmZcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9tbnQvYy9Vc2Vycy9wYXl0b256LkZVVFVSRUhPTUUvTmV4dGNsb3VkL0Rldi9HaXRIdWIvb3BlbnRha2VvZmYvdml0ZXN0LmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vbW50L2MvVXNlcnMvcGF5dG9uei5GVVRVUkVIT01FL05leHRjbG91ZC9EZXYvR2l0SHViL29wZW50YWtlb2ZmL3ZpdGVzdC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlc3QvY29uZmlnJztcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgdGVzdDoge1xuICAgIGdsb2JhbHM6IHRydWUsXG4gICAgZW52aXJvbm1lbnQ6ICdub2RlJyxcbiAgICBpbmNsdWRlOiBbJyoqLyoudGVzdC50cycsICcqKi8qLnNwZWMudHMnXSxcbiAgICBleGNsdWRlOiBbJyoqL25vZGVfbW9kdWxlcy8qKicsICcqKi9kaXN0LyoqJywgJyoqL2J1aWxkLyoqJ10sXG4gICAgY292ZXJhZ2U6IHtcbiAgICAgIHByb3ZpZGVyOiAndjgnLFxuICAgICAgcmVwb3J0ZXI6IFsndGV4dCcsICdqc29uJywgJ2h0bWwnXSxcbiAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgJyoqL25vZGVfbW9kdWxlcy8qKicsXG4gICAgICAgICcqKi9kaXN0LyoqJyxcbiAgICAgICAgJyoqL2J1aWxkLyoqJyxcbiAgICAgICAgJyoqLyouY29uZmlnLntqcyx0c30nLFxuICAgICAgICAnKiovKi5kLnRzJyxcbiAgICAgIF0sXG4gICAgfSxcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQG9wZW50YWtlb2ZmL2JhY2tlbmQnOiByZXNvbHZlKF9fZGlybmFtZSwgJy4vYXBwcy9iYWNrZW5kL3NyYycpLFxuICAgICAgJ0BvcGVudGFrZW9mZi9mcm9udGVuZCc6IHJlc29sdmUoX19kaXJuYW1lLCAnLi9hcHBzL2Zyb250ZW5kL3NyYycpLFxuICAgICAgJ0BvcGVudGFrZW9mZi91aSc6IHJlc29sdmUoX19kaXJuYW1lLCAnLi9wYWNrYWdlcy91aS9zcmMnKSxcbiAgICAgICdAb3BlbnRha2VvZmYvY29uZmlnJzogcmVzb2x2ZShfX2Rpcm5hbWUsICcuL3BhY2thZ2VzL2NvbmZpZy9zcmMnKSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXNYLFNBQVMsb0JBQW9CO0FBQ25aLFNBQVMsZUFBZTtBQUR4QixJQUFNLG1DQUFtQztBQUd6QyxJQUFPLHdCQUFRLGFBQWE7QUFBQSxFQUMxQixNQUFNO0FBQUEsSUFDSixTQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsSUFDYixTQUFTLENBQUMsZ0JBQWdCLGNBQWM7QUFBQSxJQUN4QyxTQUFTLENBQUMsc0JBQXNCLGNBQWMsYUFBYTtBQUFBLElBQzNELFVBQVU7QUFBQSxNQUNSLFVBQVU7QUFBQSxNQUNWLFVBQVUsQ0FBQyxRQUFRLFFBQVEsTUFBTTtBQUFBLE1BQ2pDLFNBQVM7QUFBQSxRQUNQO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsd0JBQXdCLFFBQVEsa0NBQVcsb0JBQW9CO0FBQUEsTUFDL0QseUJBQXlCLFFBQVEsa0NBQVcscUJBQXFCO0FBQUEsTUFDakUsbUJBQW1CLFFBQVEsa0NBQVcsbUJBQW1CO0FBQUEsTUFDekQsdUJBQXVCLFFBQVEsa0NBQVcsdUJBQXVCO0FBQUEsSUFDbkU7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
