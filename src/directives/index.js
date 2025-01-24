import {loadDirective} from "@/directives/loading.js";

export default function directive(app) {
    app.directive('loading', loadDirective)
}
