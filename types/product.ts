export interface Product {
  id: string;
  codigo: string;
  nombre: string;
  unidadMedida: string;
  grupo: string;
  stockMinimo: number;
  stockActual: number;
  precio: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Movement {
  id: string;
  tipo: 'entrada' | 'salida' | 'transferencia';
  productoId: string;
  productoNombre: string;
  productoCodigo: string;
  cantidad: number;
  almacenOrigen?: string;
  almacenDestino?: string;
  motivo: string;
  fecha: Date;
  createdAt: Date;
}

export interface UnitOfMeasure {
  id: string;
  nombre: string;
  abreviatura: string;
}

export interface ProductGroup {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface Warehouse {
  id: string;
  nombre: string;
  ubicacion: string;
}

export type ViewType = 'dashboard' | 'nuevo-producto' | 'movimientos' | 'inventario' | 'reportes' | 'buscar';
