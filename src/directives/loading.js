const sleep = async (s) => await new Promise(resolve => setTimeout(() => resolve(), s))

const createMask = () => {
    const loadingMask = document.createElement('div')
    loadingMask.classList.add('loader-mask')
    const spinner = document.createElement('div')
    spinner.classList.add('loader')
    loadingMask.appendChild(spinner)
    return loadingMask
}

export const loadDirective = {
    // 指令的生命周期钩子函数：更新时
    async updated(el, binding, vnode, prevVnode) {
        if (binding.oldValue === binding.value) return
        if (binding.value) {
            const loadingMask = createMask()
            loadingMask.classList.add('fade-in')
            el.classList.add('loader-parent--relative')
            el.appendChild(loadingMask)
            await sleep(300).then(() => loadingMask.classList.remove('fade-in'))
        } else {
            const loadingMask = el.querySelector('.loader-mask')
            loadingMask?.classList.add('fade-out')
            await sleep(300)
                .then(() => el.removeChild(loadingMask))
                .then(() => el.classList.remove('loader-parent--relative'))
        }
    }
}

