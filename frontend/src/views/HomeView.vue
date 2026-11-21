<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="container py-5 text-center">
    <h1 class="display-4 fw-bold mb-3">Trail Permit Desk</h1>
    <p class="lead text-body-secondary mb-4">
      Day-hike permits for Ridgeline Park. Request a permit for a trail and date, or find the
      permits you already have.
    </p>
    <div class="d-flex justify-content-center gap-3">
      <RouterLink to="/request-permit" class="btn btn-primary btn-lg">Request a permit</RouterLink>
      <RouterLink to="/find-permit" class="btn btn-secondary btn-lg">Find a permit</RouterLink>
    </div>
  </main>
</template>
