// Type declarations for the @splinetool/viewer web component
declare namespace JSX {
    interface IntrinsicElements {
        'spline-viewer': React.DetailedHTMLProps<
            React.HTMLAttributes<HTMLElement> & {
                url?: string;
                'loading-anim-type'?: string;
                hint?: string;
            },
            HTMLElement
        >;
    }
}
