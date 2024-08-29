import { Operation, OperationVerbs } from "@tsed/schema";
import { Controller } from "@tsed/di";

export function Handler() {
    return Operation(...[OperationVerbs.CUSTOM, ''].concat());
}

export function EventController() {
    return Controller('')
}