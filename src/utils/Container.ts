import { Constructable } from "../Common/Types";

/**
 * Service container interface
 * 
 * @export
 * @interface ContainerInterface
 */
export interface ContainerInterface {
    get<T>(cl: Constructable<T>): T;
}

const defaultContainerInstances: Map<Function, any> = new Map();

let usedContainer: ContainerInterface = {
    get: cl => {
        let ins = defaultContainerInstances.get(cl);
        if (!ins) {
            ins = new cl();
            defaultContainerInstances.set(cl, ins);
        }
        return ins;
    }
};

/**
 * Set up service container to use
 * 
 * @export
 * @param container 
 */
export function useContainer(container: ContainerInterface): void {
    usedContainer = container;
}

/**
 * Return class instance from container
 * 
 * @export
 * @template T 
 * @param cl 
 * @returns 
 */
export function getFromContainer<T>(cl: Constructable<T>): T {
    return usedContainer.get(cl);
}