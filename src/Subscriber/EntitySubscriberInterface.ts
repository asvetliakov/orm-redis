
export interface EntitySubscriberInterface<T> {
    listenTo(): T;

    beforeSave?(entity: T): Promise<void>;
    
    afterSave?(entity: T): Promise<void>;
    
    beforeGet?(objectPayload: object): Promise<void>;
    
    afterGet?(entity: T): Promise<void>;
    
    beforeRemove?(entity: T): Promise<void>;
    
    afterRemove?(entity: T): Promise<void>;
}