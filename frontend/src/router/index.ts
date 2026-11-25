import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import RequestPermitView from '../views/RequestPermitView.vue'
import SearchView from '../views/SearchView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/request-permit', name: 'request-permit', component: RequestPermitView },
    { path: '/find-permit', name: 'find-permit', component: SearchView },
    { path: '/edit-permit/:id', name: 'request-permit', component: RequestPermitView },
  ],
})

export default router
