<script setup lang="ts">
import { computed, ref } from 'vue'
import AppLoader from '@/components/AppLoader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useRequest } from '@/composables/useRequest'
import { searchPermits, type PermitSearchItem } from '@/services/permits'
import { trailLabel } from '@/utils/trails'

const STATUS: Record<PermitSearchItem['status'], { label: string; badge: string }> = {
  active: { label: 'Active', badge: 'text-bg-success' },
  expired: { label: 'Expired', badge: 'text-bg-light border' },
  cancelled: { label: 'Cancelled', badge: 'text-bg-warning' },
}

const email = ref('')
const searchedEmail = ref<string | null>(null) // the email the results are for
const { data: result, loading, run } = useRequest(searchPermits)
const pageCount = computed(() => (result.value ? Math.ceil(result.value.total / result.value.page_size) : 0))

function search() {
  const value = email.value.trim()
  if (!value) return
  searchedEmail.value = value
  run(value, 1) // a new search always starts at page 1
}

function goToPage(page: number) {
  if (searchedEmail.value) run(searchedEmail.value, page)
}
</script>

<template>
  <main class="container py-4">
    <h1 class="h3 text-center mb-4">Find a permit</h1>

    <form class="row justify-content-center mb-4" role="search" @submit.prevent="search">
      <div class="col-md-8 col-lg-6">
        <div class="input-group">
          <label for="search-email" class="visually-hidden">Email</label>
          <input
            id="search-email"
            v-model="email"
            type="email"
            class="form-control"
            placeholder="Find a permit by email"
          />
          <button type="submit" class="btn btn-primary" :disabled="!email.trim() || loading">Search</button>
        </div>
      </div>
    </form>

    <AppLoader v-if="loading" />
    <p v-else-if="searchedEmail === null" class="text-center text-body-secondary" data-test="initial">
      Enter the email used when requesting the permit to see all its permits.
    </p>
    <EmptyState v-else-if="result && result.total === 0" message="No permits found for this email." />

    <template v-else-if="result">
      <div class="table-responsive">
        <table class="table align-middle">
          <thead>
            <tr>
              <th scope="col">Trail</th>
              <th scope="col">Date</th>
              <th scope="col">Party size</th>
              <th scope="col">Permit status</th>
              <th scope="col">Trail status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="permit in result.items" :key="permit.id" :data-test="`permit-${permit.id}`">
              <td>{{ trailLabel({ code: permit.trail, name: permit.trail_name }) }}</td>
              <td>{{ permit.date }}</td>
              <td>{{ permit.party_size }}</td>
              <td>
                <span class="badge" :class="STATUS[permit.status].badge">{{ STATUS[permit.status].label }}</span>
              </td>
              <td>
                <span
                  v-if="permit.trail_status === 'closed'"
                  class="badge rounded-pill text-bg-secondary"
                  data-test="closed-pill"
                >
                  CLOSED
                </span>
                <span v-else class="text-body-secondary">Open</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav v-if="pageCount > 1" aria-label="Search results pages">
        <ul class="pagination justify-content-center">
          <li class="page-item" :class="{ disabled: result.page === 1 }">
            <button type="button" class="page-link" :disabled="result.page === 1" @click="goToPage(result.page - 1)">
              Previous
            </button>
          </li>
          <li v-for="page in pageCount" :key="page" class="page-item" :class="{ active: page === result.page }">
            <button
              type="button"
              class="page-link"
              :aria-current="page === result.page ? 'page' : undefined"
              @click="goToPage(page)"
            >
              {{ page }}
            </button>
          </li>
          <li class="page-item" :class="{ disabled: result.page === pageCount }">
            <button
              type="button"
              class="page-link"
              :disabled="result.page === pageCount"
              @click="goToPage(result.page + 1)"
            >
              Next
            </button>
          </li>
        </ul>
      </nav>
    </template>
  </main>
</template>
