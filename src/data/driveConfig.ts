export interface DriveFolderConfig {
  id: string;
  url: string;
  name: string;
  category: 'departure' | 'arrival' | 'refuel';
  description: string;
  themeColor: string;
}

export const DRIVE_FOLDERS: Record<'departure' | 'arrival' | 'refuel', DriveFolderConfig> = {
  departure: {
    id: '1QQpEqMtLkZaaDyeCLXyOA6TPrxT8qTAz',
    url: 'https://drive.google.com/drive/folders/1QQpEqMtLkZaaDyeCLXyOA6TPrxT8qTAz?usp=drive_link',
    name: 'Fotos de Saída de Veículo',
    category: 'departure',
    description: 'Armazenamento oficial de fotos do painel/odômetro na saída do NRE',
    themeColor: '#27a3df',
  },
  arrival: {
    id: '1tN3i9WirFjLldHsUcYnWT14AowcisbMc',
    url: 'https://drive.google.com/drive/folders/1tN3i9WirFjLldHsUcYnWT14AowcisbMc?usp=drive_link',
    name: 'Fotos de Chegada de Veículo',
    category: 'arrival',
    description: 'Armazenamento oficial de fotos do painel/odômetro na devolução ao pátio',
    themeColor: '#03bb85',
  },
  refuel: {
    id: '1-l1lk0GGVKxDTL6ZvNt5StGHOJt-iwYJ',
    url: 'https://drive.google.com/drive/folders/1-l1lk0GGVKxDTL6ZvNt5StGHOJt-iwYJ?usp=drive_link',
    name: 'Comprovantes de Abastecimento',
    category: 'refuel',
    description: 'Armazenamento oficial de notas fiscais e comprovantes de combustível',
    themeColor: '#efb810',
  },
};
