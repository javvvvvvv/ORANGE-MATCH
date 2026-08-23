/* ============================================================================
   PROPIEDAD INTELECTUAL Y LICENCIA COMERCIAL CERRADA
   ============================================================================
   Autor Legal y Titular de Derechos: JAVIER ILLAN GONZALEZ
   Organización: ORANGE CREW
   Contacto: ILLANJAVIER9@GMAIL.COM

   ADVERTENCIA LEGAL (MÉXICO Y GLOBAL):
   Este código fuente y su arquitectura son propiedad intelectual exclusiva de
   JAVIER ILLAN GONZALEZ. Queda estrictamente prohibida su reproducción,
   distribución, modificación, ingeniería inversa, copia o uso comercial sin la
   autorización expresa y por escrito del autor. Obra protegida conforme a la
   Ley Federal del Derecho de Autor y tratados internacionales aplicables.
   ============================================================================ */

import React from 'react';

export class PapelesTrabajoErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`Error en ${this.props.moduleName || 'Papeles de Trabajo'}:`, error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error instanceof Error
      ? this.state.error.message
      : String(this.state.error);

    return (
      <section className="papeles-error" role="alert">
        <h3>Error al mostrar el módulo</h3>
        <p>{this.props.moduleName || 'Papeles de Trabajo'}</p>
        <pre>{message}</pre>
        <button type="button" className="btn btn-primary" onClick={this.handleRetry}>
          Reintentar
        </button>
      </section>
    );
  }
}
