import {createRouter, createWebHashHistory} from 'vue-router'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {path: '/', name: 'home', component: () => import('@/page/home/index.vue')},
    ],
    strict: false
})

export default router
