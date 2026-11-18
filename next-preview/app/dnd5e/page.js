import { redirect } from 'next/navigation';

export default function Dnd5ePage() {
  redirect('/sistemas/dnd5e/ficha/ficha.html?preview=1');
}
