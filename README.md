#Puzzle Game
A game in which the player controls multiple characters(white squares) with wasd or arrow keys. Avoid lava and enemies to reach the green square. Have fun!

#Controls
wasd or arrow keys to move
escape or p to close/quit

#Colors
White = player(pulse with music)
Orange = lava
Red = enemy
  dots = enemy path
Green = final goal
Grey = Wall
Black = Empty


#Maps
to create a map for level n, create a file in the maps directory called 'map'+n. ex. map12
maps are 26*16 characters
 LEVEL DESIGN CODE:
   * # = wall
   *  = empty
   * P =player
   * 1-9 = enemy(start @ 1, go to 9)
   * x = lava
   * ! = final goal
ex. 
<p>
######################x##
xP####################P##
# #################x   ##
#65432#############x #x##
#7##x1#############!  ###
#8 ##!##############x####
#9#######x##x############
#########x##x############
#########x##x############
#######x######x##########
########x####x###########
#########xxxx#####x######
################## !#####
# ###############x x#####
#P !#############x    P #
#x####################x##
  </p>
