export interface DecoratorStructureItem {
    values: any[];
    children?: {
        [key: string]: DecoratorStructureItem
    };
}