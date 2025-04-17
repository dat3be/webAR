declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        ar?: boolean;
        'environment-image'?: string;
        poster?: string;
        'shadow-intensity'?: string | number;
        'camera-controls'?: boolean;
        'touch-action'?: string;
        autoplay?: boolean;
        'auto-rotate'?: boolean;
        loading?: 'auto' | 'lazy' | 'eager';
        reveal?: 'auto' | 'manual' | 'interaction';
        'ar-modes'?: string;
        'ar-scale'?: 'auto' | 'fixed';
        'ar-placement'?: 'floor' | 'wall';
        'quick-look-browsers'?: string;
        'min-camera-orbit'?: string;
        'max-camera-orbit'?: string;
        'camera-orbit'?: string;
        'min-field-of-view'?: string;
        'max-field-of-view'?: string;
        'field-of-view'?: string;
      },
      HTMLElement
    >;
  }
}