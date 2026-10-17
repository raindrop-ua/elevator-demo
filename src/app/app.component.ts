import { Component } from '@angular/core';
import { SimulatorComponent } from '@features/simulator/simulator.component';

@Component({
  imports: [SimulatorComponent],
  selector: 'app-root',
  styleUrl: './app.component.css',
  templateUrl: './app.component.html',
})
export class AppComponent {}
