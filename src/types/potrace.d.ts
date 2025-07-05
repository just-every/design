declare module 'potrace' {
    export interface PotraceOptions {
        color?: string;
        background?: string;
        threshold?: number;
        turnPolicy?: TurnPolicy;
        alphaMax?: number;
        turdSize?: number;
        steps?: number;
    }

    export enum TurnPolicy {
        TURNPOLICY_BLACK = 'black',
        TURNPOLICY_WHITE = 'white',
        TURNPOLICY_LEFT = 'left',
        TURNPOLICY_RIGHT = 'right',
        TURNPOLICY_MINORITY = 'minority',
        TURNPOLICY_MAJORITY = 'majority'
    }

    export const Potrace: {
        TURNPOLICY_BLACK: TurnPolicy;
        TURNPOLICY_WHITE: TurnPolicy;
        TURNPOLICY_LEFT: TurnPolicy;
        TURNPOLICY_RIGHT: TurnPolicy;
        TURNPOLICY_MINORITY: TurnPolicy;
        TURNPOLICY_MAJORITY: TurnPolicy;
    };

    export function trace(
        inputPath: string,
        options: PotraceOptions,
        callback: (err: Error | null, svg: string) => void
    ): void;

    export function trace(
        inputPath: string,
        callback: (err: Error | null, svg: string) => void
    ): void;
}