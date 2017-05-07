import java.awt.Point;
/**
 * Auto Generated Java Class.
 */
public class Bullet extends Point {
  
  /* ADD YOUR CODE HERE */
  double direction;
  public Bullet(Point p, double dir){
    x = p.x;
    y = p.y;
    direction = dir;
  }
  public void tick(){
   x+=Math.cos(direction);
   y+=Math.sin(direction);
  }
}
