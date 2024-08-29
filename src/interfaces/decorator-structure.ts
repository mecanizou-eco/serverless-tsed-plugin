import { DecoratorStructureItem } from "./decorator-structure-item";

export interface DecoratorStructure {
    [key: string]: Array<DecoratorStructureItem>;
}